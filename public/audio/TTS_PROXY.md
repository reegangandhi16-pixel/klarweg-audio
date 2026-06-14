# Klarweg TTS Proxy — reference implementation (deploy once)

Approach C calls a hosted Neural TTS endpoint on demand and caches the result
in the browser (IndexedDB). The client never holds the API key — a tiny
serverless proxy does. Deploy **one** of these, then set its URL in
`public/audio/kw-tts-config.js`.

The proxy must accept `POST { text, voice, provider, lang }` and return
`audio/mpeg` **or** JSON `{ audioContent: "<base64 mp3>" }`.

---

## Cloudflare Worker (Google TTS) — ~30 lines

```js
export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': 'https://klarweg.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

    const { text, voice = 'de-DE-Neural2-F' } = await req.json();
    if (!text) return new Response('Bad Request', { status: 400, headers: cors });

    const g = await fetch(
      'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + env.GOOGLE_TTS_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: 'de-DE', name: voice },
          audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0 },
        }),
      }
    );
    if (!g.ok) return new Response('TTS error', { status: 502, headers: cors });
    const j = await g.json();            // { audioContent: "<base64>" }
    return new Response(JSON.stringify({ audioContent: j.audioContent }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};
```

Deploy: `wrangler deploy`, set `GOOGLE_TTS_API_KEY` as a secret, then put the
Worker URL into `kw-tts-config.js`.

---

## Switching providers

The client sends `provider`; your proxy maps it to the vendor:

| provider     | vendor endpoint                                   | env var                 |
|--------------|---------------------------------------------------|-------------------------|
| `google`     | texttospeech.googleapis.com                       | `GOOGLE_TTS_API_KEY`    |
| `azure`      | <region>.tts.speech.microsoft.com                 | `AZURE_SPEECH_KEY`      |
| `polly`      | AWS Polly SynthesizeSpeech (SigV4)                | AWS creds               |
| `elevenlabs` | api.elevenlabs.io/v1/text-to-speech/<voice>       | `ELEVENLABS_API_KEY`    |

The Klarweg client code never changes — only the proxy's switch statement.
```
