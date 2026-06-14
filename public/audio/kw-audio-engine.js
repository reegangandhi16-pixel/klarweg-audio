/**
 * public/audio/kw-audio-engine.js
 * ----------------------------------------------------------------------------
 * KLARWEG UNIFIED AUDIO ENGINE (Approach C — long-term architecture)
 *
 * Resolution chain for any German string:
 *
 *    1. Manifest      (pre-generated MP3, fast path — optional)
 *    2. IndexedDB     (cached TTS blob, keyed by the text itself)
 *    3. Hosted Neural TTS endpoint (on-demand; result is cached → step 2)
 *    4. Browser speechSynthesis (de-DE) — graceful fallback
 *    5. Visible error / disabled button — last resort
 *
 * No pre-generated manifest is REQUIRED — it's purely an optional fast path.
 * Audio for any new word/sentence is produced on demand and cached forever.
 *
 * Public API (back-compat with the old runtime + new methods):
 *    window.audioUrl(text)              → manifest URL if present, else undefined
 *    window.KW_speak(text, opts)        → resolve + play (returns Promise<'manifest'|'cache'|'tts-endpoint'|'browser-tts'|'error'>)
 *    window.KW_playAudio(text, opts)    → alias of KW_speak (Promise<boolean-ish>)
 *    window.KW_audioState(text)         → 'manifest'|'cache'|'remote'|'browser'|'none' (no playback; for button gating)
 *    window.KW_prepare(text)            → ensure audio is available (cache/generate) without playing; Promise
 *    window.KW_cacheStats()             → { items, bytes, hits, misses, hitRate }
 *    window.KW_onAudioEvent(fn)         → subscribe to lifecycle events
 *    window.KW_TTS                      → provider abstraction (configure endpoint/provider)
 * ------------------------------------------------------------------------- */
(function (global) {
  'use strict';

  var LOG = '[kw-audio]';
  var DEBUG = /[?&]kwaudio=debug/.test(global.location ? global.location.search : '');

  /* ── Real Audio constructor (shadow-proof) ───────────────────────────── */
  var AudioCtor = global.Audio || (typeof Audio !== 'undefined' ? Audio : null);

  /* ── Event bus ───────────────────────────────────────────────────────── */
  var listeners = [];
  function emit(type, data) {
    var ev = Object.assign({ type: type, t: Date.now() }, data || {});
    if (DEBUG) console.log(LOG, type, data || '');
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](ev); } catch (e) {} }
  }

  /* ── Text normalization (cache key) ──────────────────────────────────── */
  function normalize(text) {
    return String(text == null ? '' : text)
      .replace(/\s+/g, ' ')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .trim();
  }

  /* ════════════════════════════════════════════════════════════════════
     1. MANIFEST (optional fast path)
     ════════════════════════════════════════════════════════════════════ */
  var MAP = {}, MAP_LC = {}, manifestReady = false, manifestBase = '/audio/';
  (function loadManifest() {
    var base = '/audio/';
    try {
      var s = document.currentScript && document.currentScript.src;
      if (s) base = s.replace(/[^/]*$/, '');
    } catch (e) {}
    manifestBase = base;
    var candidates = [base + 'manifest.json', '/audio/manifest.json', '/public/audio/manifest.json', 'public/audio/manifest.json'];
    var i = 0;
    (function next() {
      if (i >= candidates.length) { manifestReady = true; emit('manifest-loaded', { entries: 0, source: 'none' }); return; }
      fetch(candidates[i], { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (json) {
          MAP = json || {};
          MAP_LC = {};
          for (var k in MAP) if (Object.prototype.hasOwnProperty.call(MAP, k)) MAP_LC[normalize(k).toLowerCase()] = MAP[k];
          manifestReady = true;
          emit('manifest-loaded', { entries: Object.keys(MAP).length, source: candidates[i] });
        })
        .catch(function () { i++; next(); });
    })();
  })();

  function manifestEntry(text) {
    var n = normalize(text);
    return MAP[n] || MAP_LC[n.toLowerCase()] || MAP_LC[n.toLowerCase().replace(/[.,!?;:]+$/, '')];
  }
  function relOf(entry) { return !entry ? undefined : (typeof entry === 'string' ? entry : entry.audio); }
  function resolveUrl(rel) {
    if (!rel) return undefined;
    return (rel.indexOf('http') === 0) ? rel : rel.replace(/^\/audio\//, manifestBase);
  }
  function audioUrl(text) {
    var rel = relOf(manifestEntry(text));
    return rel ? resolveUrl(rel) : undefined;
  }
  function dialogueInfo(text) { var e = manifestEntry(text); return (e && typeof e === 'object') ? e : undefined; }
  function wordMarks(text) { var e = manifestEntry(text); return (e && typeof e === 'object' && Array.isArray(e.marks) && e.marks.length) ? e.marks : undefined; }

  /* ════════════════════════════════════════════════════════════════════
     2. INDEXEDDB CACHE (text → audio blob)
     ════════════════════════════════════════════════════════════════════ */
  var DB_NAME = 'klarweg-audio', STORE = 'clips', DB_VER = 1;
  var dbPromise = null;
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      if (!global.indexedDB) { resolve(null); return; }
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { resolve(null); };
    });
    return dbPromise;
  }
  function cacheGet(key) {
    return openDB().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        tx.onsuccess = function () { resolve(tx.result || null); };
        tx.onerror = function () { resolve(null); };
      });
    });
  }
  function cachePut(key, blob, meta) {
    return openDB().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        var rec = { blob: blob, bytes: blob.size, voice: (meta && meta.voice) || '', createdAt: Date.now() };
        var tx = db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec, key);
        tx.onsuccess = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    });
  }
  function cacheStats() {
    return openDB().then(function (db) {
      if (!db) return { items: 0, bytes: 0, hits: STATS.hits, misses: STATS.misses, hitRate: hitRate() };
      return new Promise(function (resolve) {
        var store = db.transaction(STORE, 'readonly').objectStore(STORE);
        var items = 0, bytes = 0;
        var cur = store.openCursor();
        cur.onsuccess = function () {
          var c = cur.result;
          if (c) { items++; bytes += (c.value && c.value.bytes) || 0; c.continue(); }
          else resolve({ items: items, bytes: bytes, hits: STATS.hits, misses: STATS.misses, hitRate: hitRate() });
        };
        cur.onerror = function () { resolve({ items: items, bytes: bytes, hits: STATS.hits, misses: STATS.misses, hitRate: hitRate() }); };
      });
    });
  }
  function cacheClear() {
    return openDB().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
        tx.onsuccess = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    });
  }
  var STATS = { hits: 0, misses: 0 };
  function hitRate() { var t = STATS.hits + STATS.misses; return t ? Math.round(STATS.hits / t * 100) : 0; }

  /* ════════════════════════════════════════════════════════════════════
     3. HOSTED NEURAL TTS — provider abstraction
        Configure with: window.KW_TTS.configure({ endpoint, provider, voice })
        The endpoint must accept { text, voice, provider } and return audio
        (audio/mpeg) OR JSON { audioContent: "<base64>" }. A serverless proxy
        keeps the key server-side. Until configured, this layer is skipped.
     ════════════════════════════════════════════════════════════════════ */
  var TTS = {
    endpoint: null,                    // e.g. 'https://tts.yoursite.com/api/tts'
    provider: 'google',                // google | azure | polly | elevenlabs
    voice: 'de-DE-Neural2-F',
    maleVoice: 'de-DE-Neural2-B',
    enabled: false,
    configure: function (cfg) {
      cfg = cfg || {};
      if (cfg.endpoint !== undefined) TTS.endpoint = cfg.endpoint;
      if (cfg.provider) TTS.provider = cfg.provider;
      if (cfg.voice) TTS.voice = cfg.voice;
      if (cfg.maleVoice) TTS.maleVoice = cfg.maleVoice;
      TTS.enabled = !!TTS.endpoint;
      emit('tts-configured', { provider: TTS.provider, enabled: TTS.enabled });
      return TTS;
    },
    /** Provider-agnostic call. Returns a Blob or throws. */
    synthesize: function (text, opts) {
      opts = opts || {};
      if (!TTS.endpoint) return Promise.reject(new Error('no-endpoint'));
      var voice = opts.voice || (opts.gender === 'male' ? TTS.maleVoice : TTS.voice);
      var body = { text: normalize(text), voice: voice, provider: TTS.provider, lang: 'de-DE' };
      emit('remote-request', { text: normalize(text), provider: TTS.provider, voice: voice });
      return fetch(TTS.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (!res.ok) throw new Error('tts-' + res.status);
        var ct = res.headers.get('content-type') || '';
        if (ct.indexOf('application/json') >= 0) {
          return res.json().then(function (j) {
            if (!j.audioContent) throw new Error('no-audioContent');
            // base64 → Blob
            var bin = atob(j.audioContent), len = bin.length, arr = new Uint8Array(len);
            for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
            return new Blob([arr], { type: 'audio/mpeg' });
          });
        }
        return res.blob();
      });
    }
  };

  /* ════════════════════════════════════════════════════════════════════
     4. BROWSER speechSynthesis (de-DE) fallback
     ════════════════════════════════════════════════════════════════════ */
  function browserTTS(text, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (!global.speechSynthesis || !global.SpeechSynthesisUtterance) { resolve(false); return; }
      try {
        global.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(normalize(text));
        u.lang = 'de-DE';
        u.rate = opts.rate || 1;
        var done = false, fin = function (ok) { if (done) return; done = true; resolve(ok); };
        u.onstart = function () { emit('play-start', { source: 'browser-tts' }); };
        u.onend = function () { fin(true); };
        u.onerror = function () { fin(false); };
        global.speechSynthesis.speak(u);
        setTimeout(function () { fin(true); }, 800 + normalize(text).length * 80);
      } catch (e) { resolve(false); }
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     PLAYBACK — single owner (no overlap), element cache for instant replay
     ════════════════════════════════════════════════════════════════════ */
  var current = null, urlCache = {};
  function stopCurrent() {
    if (current) { try { current.pause(); current.currentTime = 0; } catch (e) {} current = null; }
    if (global.speechSynthesis) { try { global.speechSynthesis.cancel(); } catch (e) {} }
  }
  function playUrl(url, opts) {
    opts = opts || {};
    stopCurrent();
    if (!AudioCtor) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var a = urlCache[url] || (urlCache[url] = new AudioCtor(url));
      try { a.currentTime = 0; } catch (e) {}
      if (opts.rate) { try { a.playbackRate = opts.rate; } catch (e) {} }
      current = a;
      if (typeof opts.onAudio === 'function') { try { opts.onAudio(a); } catch (e) {} }
      var settled = false;
      var onEnd = function () { if (!settled) { settled = true; } if (typeof opts.onEnded === 'function') opts.onEnded(); emit('play-complete', { url: url }); };
      a.addEventListener('ended', onEnd, { once: true });
      a.addEventListener('error', function () { emit('play-error', { url: url, code: a.error && a.error.code }); resolve(false); }, { once: true });
      var p = a.play();
      if (p && p.then) p.then(function () { emit('play-start', { url: url, source: opts._src || 'file' }); resolve(true); })
                        .catch(function (err) { emit('play-error', { url: url, name: err && err.name }); resolve(false); });
      else resolve(true);
    });
  }
  function playBlob(blob, opts) {
    var url = URL.createObjectURL(blob);
    return playUrl(url, opts);
  }

  /* ════════════════════════════════════════════════════════════════════
     RESOLVE STATE (for button gating — NEVER show silent buttons)
     Returns the BEST source available WITHOUT playing:
        'manifest' | 'cache' | 'remote' | 'browser' | 'none'
     ════════════════════════════════════════════════════════════════════ */
  function audioState(text) {
    return Promise.resolve().then(function () {
      if (audioUrl(text)) return 'manifest';
      return cacheGet(normalize(text)).then(function (rec) {
        if (rec && rec.blob) return 'cache';
        if (TTS.enabled) return 'remote';
        if (global.speechSynthesis && global.SpeechSynthesisUtterance) return 'browser';
        return 'none';
      });
    });
  }
  // Synchronous best-guess (manifest + endpoint + browser) for instant gating;
  // cache is async so callers should prefer KW_audioStateAsync where possible.
  function audioStateSync(text) {
    if (audioUrl(text)) return 'manifest';
    if (TTS.enabled) return 'remote';
    if (global.speechSynthesis && global.SpeechSynthesisUtterance) return 'browser';
    return 'none';
  }

  /* ════════════════════════════════════════════════════════════════════
     PREPARE — ensure audio exists (cache or generate) WITHOUT playing
     ════════════════════════════════════════════════════════════════════ */
  function prepare(text, opts) {
    opts = opts || {};
    var key = normalize(text);
    if (audioUrl(text)) return Promise.resolve('manifest');
    return cacheGet(key).then(function (rec) {
      if (rec && rec.blob) { STATS.hits++; return 'cache'; }
      STATS.misses++;
      if (!TTS.enabled) return TTS.enabled ? 'remote' : (global.speechSynthesis ? 'browser' : 'none');
      return TTS.synthesize(text, opts).then(function (blob) {
        return cachePut(key, blob, { voice: opts.voice }).then(function () { emit('cache-store', { text: key, bytes: blob.size }); return 'cache'; });
      }).catch(function () { return global.speechSynthesis ? 'browser' : 'none'; });
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     SPEAK — the full chain. Returns the source actually used.
     opts: { rate, voice, gender, onAudio, onEnded, onState(state) }
     ════════════════════════════════════════════════════════════════════ */
  function speak(text, opts) {
    opts = opts || {};
    var key = normalize(text);
    emit('request', { text: key });
    var notify = function (s) { if (typeof opts.onState === 'function') opts.onState(s); };

    // 1. Manifest fast path
    var mUrl = audioUrl(text);
    if (mUrl) { notify('playing'); return playUrl(mUrl, Object.assign({ _src: 'manifest' }, opts)).then(function (ok) { return ok ? 'manifest' : fallbackChain(text, key, opts, notify); }); }

    // 2/3/4
    return fallbackChain(text, key, opts, notify);
  }

  function fallbackChain(text, key, opts, notify) {
    // 2. IndexedDB cache
    return cacheGet(key).then(function (rec) {
      if (rec && rec.blob) { STATS.hits++; emit('cache-hit', { text: key }); notify('playing'); return playBlob(rec.blob, Object.assign({ _src: 'cache' }, opts)).then(function (ok) { return ok ? 'cache' : afterCache(text, key, opts, notify); }); }
      STATS.misses++; emit('cache-miss', { text: key });
      return afterCache(text, key, opts, notify);
    });
  }

  function afterCache(text, key, opts, notify) {
    // 3. Hosted TTS (generate → cache → play)
    if (TTS.enabled) {
      notify('generating');                       // "Generating audio..."
      return TTS.synthesize(text, opts).then(function (blob) {
        return cachePut(key, blob, { voice: opts.voice }).then(function () {
          emit('cache-store', { text: key, bytes: blob.size });
          notify('playing');                      // auto-play on completion
          return playBlob(blob, Object.assign({ _src: 'tts-endpoint' }, opts)).then(function (ok) { return ok ? 'tts-endpoint' : afterRemote(text, opts, notify); });
        });
      }).catch(function (err) { emit('remote-error', { text: key, msg: err && err.message }); return afterRemote(text, opts, notify); });
    }
    return afterRemote(text, opts, notify);
  }

  function afterRemote(text, opts, notify) {
    // 4. Browser speechSynthesis
    notify('playing');
    return browserTTS(text, opts).then(function (ok) {
      if (ok) return 'browser-tts';
      // 5. Nothing worked
      notify('error');
      emit('all-failed', { text: normalize(text) });
      return 'error';
    });
  }

  /* ── Public API ──────────────────────────────────────────────────────── */
  global.audioUrl = audioUrl;
  global.KW_dialogueInfo = dialogueInfo;
  global.KW_wordMarks = wordMarks;
  global.KW_speak = speak;
  global.KW_playAudio = function (text, opts) { return speak(text, opts).then(function (src) { return src && src !== 'error'; }); };
  global.KW_stopAudio = stopCurrent;
  global.KW_prepare = prepare;
  global.KW_audioState = audioStateSync;
  global.KW_audioStateAsync = audioState;
  global.KW_cacheStats = cacheStats;
  global.KW_cacheClear = cacheClear;
  global.KW_onAudioEvent = function (fn) { if (typeof fn === 'function') listeners.push(fn); return function () { listeners = listeners.filter(function (x) { return x !== fn; }); }; };
  global.KW_audioReady = function () { return manifestReady; };
  global.KW_TTS = TTS;
  global.KW_audioDebug = function () {
    return cacheStats().then(function (cs) {
      var info = { manifestEntries: Object.keys(MAP).length, manifestReady: manifestReady, ttsEnabled: TTS.enabled, ttsProvider: TTS.provider, cache: cs };
      console.log(LOG, 'DEBUG', info); return info;
    });
  };

  emit('engine-ready', { manifestBase: manifestBase });
})(window);
