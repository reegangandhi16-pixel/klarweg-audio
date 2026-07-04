/**
 * lib/llm.ts
 * ----------------------------------------------------------------------------
 * Provider-agnostic LLM adapter. The rest of the app calls callLLM() and never
 * touches a vendor SDK or an API key — swap providers via env LLM_PROVIDER.
 *
 *   const { text, usage } = await callLLM({
 *     system: "You are …",
 *     messages: [{ role: "user", content: "…" }],
 *     maxTokens: 600,
 *   });
 *
 * Keys are read from the SERVER environment only. Never import this into client
 * code — it must run in a route handler / server action.
 */

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  /** Abort the upstream call after this many ms (default 20s). */
  timeoutMs?: number;
}

export interface LLMResult {
  text: string;
  usage?: { input?: number; output?: number };
  model: string;
  provider: string;
}

export class LLMError extends Error {
  status: number;
  retriable: boolean;
  constructor(message: string, status = 502, retriable = true) {
    super(message);
    this.name = 'LLMError';
    this.status = status;
    this.retriable = retriable;
  }
}

const PROVIDER = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
const MODEL =
  process.env.LLM_MODEL ||
  (PROVIDER === 'gemini'
    ? 'gemini-1.5-flash'
    : PROVIDER === 'anthropic'
    ? 'claude-sonnet-4-20250514'
    : '');

/** Public entry point — dispatches to the configured provider. */
export async function callLLM(req: LLMRequest): Promise<LLMResult> {
  switch (PROVIDER) {
    case 'gemini':
      return callGemini(req);
    case 'anthropic':
      return callAnthropic(req);
    case 'openai':
      return callOpenAI(req);
    default:
      throw new LLMError(`Unknown LLM_PROVIDER "${PROVIDER}"`, 500, false);
  }
}

/* ── Google Gemini — primary provider ─────────────────────────────────────── */
async function callGemini(req: LLMRequest): Promise<LLMResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LLMError('GEMINI_API_KEY is not set on the server', 500, false);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), req.timeoutMs ?? 20_000);

  // Gemini's REST shape: systemInstruction + contents[] of { role, parts[] }.
  // Roles map: our 'assistant' → Gemini 'model'; 'user' stays 'user'.
  const contents = req.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // Key in a header (not the query string) so it doesn't land in logs.
        'x-goog-api-key': key,
      },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents,
        generationConfig: {
          temperature: req.temperature ?? 0.3,
          maxOutputTokens: req.maxTokens ?? 600,
        },
        // Don't let safety filters silently nuke ordinary language-learning text.
        safetySettings: [
          'HARM_CATEGORY_HARASSMENT',
          'HARM_CATEGORY_HATE_SPEECH',
          'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          'HARM_CATEGORY_DANGEROUS_CONTENT',
        ].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' })),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const retriable = res.status === 429 || res.status >= 500;
      throw new LLMError(`Gemini ${res.status}: ${body.slice(0, 300)}`, res.status, retriable);
    }

    const json = (await res.json()) as any;

    // A prompt blocked by safety returns no candidates — treat as a clean error
    // so the route falls back to the chapter-grounded response.
    const cand = json.candidates?.[0];
    if (!cand) {
      const reason = json.promptFeedback?.blockReason || 'no candidates';
      throw new LLMError(`Gemini returned no answer (${reason})`, 502, false);
    }

    const text = (cand.content?.parts || [])
      .map((p: any) => p.text || '')
      .join('')
      .trim();

    const um = json.usageMetadata || {};
    return {
      text,
      usage: { input: um.promptTokenCount, output: um.candidatesTokenCount },
      model: MODEL,
      provider: 'gemini',
    };
  } catch (err: any) {
    if (err instanceof LLMError) throw err;
    if (err?.name === 'AbortError') throw new LLMError('Gemini request timed out', 504, true);
    throw new LLMError(`Gemini request failed: ${err?.message || err}`, 502, true);
  } finally {
    clearTimeout(t);
  }
}

/* ── Anthropic (Claude) — implemented ─────────────────────────────────────── */
async function callAnthropic(req: LLMRequest): Promise<LLMResult> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new LLMError('ANTHROPIC_API_KEY is not set on the server', 500, false);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), req.timeoutMs ?? 20_000);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: req.maxTokens ?? 600,
        temperature: req.temperature ?? 0.3,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // 429 / 5xx are worth retrying or falling back; 4xx are not.
      const retriable = res.status === 429 || res.status >= 500;
      throw new LLMError(`Anthropic ${res.status}: ${body.slice(0, 300)}`, res.status, retriable);
    }

    const json = (await res.json()) as any;
    const text = (json.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('')
      .trim();

    return {
      text,
      usage: { input: json.usage?.input_tokens, output: json.usage?.output_tokens },
      model: MODEL,
      provider: 'anthropic',
    };
  } catch (err: any) {
    if (err instanceof LLMError) throw err;
    if (err?.name === 'AbortError') throw new LLMError('Anthropic request timed out', 504, true);
    throw new LLMError(`Anthropic request failed: ${err?.message || err}`, 502, true);
  } finally {
    clearTimeout(t);
  }
}

/* ── OpenAI — stub for easy swap (fill in if you switch providers) ─────────── */
async function callOpenAI(_req: LLMRequest): Promise<LLMResult> {
  throw new LLMError('OpenAI provider not implemented — set LLM_PROVIDER=gemini', 500, false);
}
