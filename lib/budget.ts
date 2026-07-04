/**
 * lib/budget.ts
 * ----------------------------------------------------------------------------
 * Global daily spend breaker for the AI tutor.
 *
 * Tracks total tokens used per UTC day in Redis and trips when the configured
 * ceiling is reached — so a quota/credit-card surprise is impossible even under
 * a distributed flood. When Redis is unavailable it FAILS OPEN for tokens
 * accounting (don't block paying users on a metrics outage) but the rate
 * limiter still fails closed, so abuse is bounded either way.
 *
 * ENV:
 *   DAILY_TOKEN_BUDGET   (default 5_000_000 tokens/day; set from your cost cap)
 *   UPSTASH_REDIS_REST_URL / _TOKEN  (or KV_REST_API_URL / _TOKEN)
 */
const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const DAILY_BUDGET = Number(process.env.DAILY_TOKEN_BUDGET || 5_000_000);

function dayKey(): string {
  return 'budget:' + new Date().toISOString().slice(0, 10); // budget:YYYY-MM-DD
}

async function redis(cmd: (string | number)[]): Promise<any | null> {
  if (!REST_URL || !REST_TOKEN) return null;
  try {
    const res = await fetch(REST_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${REST_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(cmd),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    return (await res.json())?.result ?? null;
  } catch {
    return null;
  }
}

/** True if today's spend is still under the ceiling. Fails open if Redis down. */
export async function checkBudget(): Promise<{ ok: boolean; used?: number }> {
  const used = await redis(['GET', dayKey()]);
  if (used === null) return { ok: true }; // no metrics → don't block users
  return { ok: Number(used) < DAILY_BUDGET, used: Number(used) };
}

/** Add this request's token usage to today's running total (TTL 2 days). */
export async function recordSpend(tokens: number): Promise<void> {
  if (!tokens || tokens < 0) return;
  const key = dayKey();
  const total = await redis(['INCRBY', key, Math.round(tokens)]);
  if (total !== null) await redis(['EXPIRE', key, String(60 * 60 * 48)]);
}
