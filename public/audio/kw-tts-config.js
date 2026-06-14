/**
 * public/audio/kw-tts-config.js
 * ----------------------------------------------------------------------------
 * Configure the hosted Neural TTS endpoint for the Klarweg audio engine.
 *
 * Load this AFTER kw-audio-engine.js on every page:
 *    <script src="/audio/kw-audio-engine.js"></script>
 *    <script src="/audio/kw-tts-config.js"></script>
 *
 * Set `endpoint` to your serverless TTS proxy (Cloudflare Worker / Vercel /
 * Netlify function) that holds the provider key server-side. The proxy must:
 *   • accept POST { text, voice, provider, lang }
 *   • return audio/mpeg  OR  JSON { audioContent: "<base64 mp3>" }
 *
 * Until you set a real endpoint, the engine skips the hosted-TTS layer and
 * falls back to browser speechSynthesis — so audio still works everywhere.
 *
 * Provider abstraction: change `provider` to switch backends without touching
 * the client — your proxy maps the provider name to the right vendor API.
 */
(function () {
  if (!window.KW_TTS) return;
  window.KW_TTS.configure({
    // ⬇️  Replace with your deployed proxy URL to enable Neural TTS on-demand.
    endpoint: null,            // e.g. 'https://klarweg-tts.<you>.workers.dev/tts'
    provider: 'google',        // google | azure | polly | elevenlabs
    voice: 'de-DE-Neural2-F',  // default / female
    maleVoice: 'de-DE-Neural2-B'
  });
})();
