/**
 * public/audio/kw-audio.js — UNIFIED AUDIO MANAGER (v2)
 * ----------------------------------------------------------------------------
 * One centralized, dependency-free audio service used by EVERY page
 * (homepage, chapters, vocabulary, dialogue, saved words). No bundler.
 *
 * PUBLIC API (backward compatible — existing callers keep working):
 *   window.audioUrl(text)              → resolved MP3 URL | undefined
 *   window.KW_dialogueInfo(text)       → { text, speaker, voice, audio } | undefined
 *   window.KW_playAudio(text, opts)    → Promise<boolean>  (true once playing)
 *        opts: { onAudio(el), onEnded(), rate, volume }
 *   window.KW_stopAudio()              → stop + release current clip
 *   window.KW_speak(text, opts)        → Promise<'file'|'tts'|'none'> (MP3, else TTS)
 *   window.KW_audioReady()             → manifest loaded?
 *   window.KW_audioDebug()             → console diagnostic + return summary
 *
 * NEW in v2:
 *   window.KW_audioPreload(list)       → warm the cache for an array of texts
 *   window.KW_onAudioEvent(fn)         → subscribe to structured telemetry events
 *
 * Design decisions (why):
 *   • Single owner of the "currently playing" clip → no accidental overlap.
 *   • Per-URL HTMLAudioElement cache (preload=auto) → instant replays, fewer
 *     allocations, lower time-to-first-audio.
 *   • Real Audio constructor captured at load → immune to page `const Audio={}`
 *     shadowing (a real past failure).
 *   • play() rejection downgrades to TTS instead of silently "succeeding".
 *   • Manifest from multiple candidate URLs, revalidated (no stale cache bug).
 *   • Structured telemetry for: request, cache-hit, play-start, play-complete,
 *     play-error, network-error — subscribe via KW_onAudioEvent or watch console.
 */
(function (global) {
  'use strict';

  var LOG = '[kw-audio]';
  var DEBUG = /[?&]kwaudio=debug/.test(global.location ? global.location.search : '');
  var AUDIO_DEBUG = DEBUG;

  /* ── Telemetry ──────────────────────────────────────────────────────────── */
  var listeners = [];
  function emit(type, data) {
    var ev = Object.assign({ type: type, t: Date.now() }, data || {});
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](ev); } catch (e) {} }
    if (DEBUG) console.debug(LOG, type, data || '');
  }

  /* ── Real Audio constructor (shadow-proof) ──────────────────────────────── */
  var AudioCtor = global.Audio || (typeof Audio !== 'undefined' ? Audio : null);

  /* ── Resolve where this script lives (for relative manifest/mp3) ────────── */
  var BASE = (function () {
    try {
      var s = document.currentScript && document.currentScript.src;
      if (s) return s.replace(/[^/]*$/, '');
    } catch (e) {}
    return '/audio/';
  })();

  var MANIFEST_CANDIDATES = [
    BASE + 'manifest.json',
    '/audio/manifest.json',
    '/public/audio/manifest.json',
    'public/audio/manifest.json',
    './public/audio/manifest.json'
  ];

  var MAP = {};         // exact-key manifest
  var MAP_LC = {};      // lowercased-key index (case-insensitive fallback)
  var MANIFEST_BASE = BASE;
  var ready = false;
  var loadedFrom = null;
  var loadError = null;

  function normalize(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .trim();
  }

  function resolveUrl(rel) {
    if (!rel) return undefined;
    if (/^https?:\/\//.test(rel)) return rel;
    var path = String(rel).replace(/^\/?audio\//, '').replace(/^\//, '');
    return MANIFEST_BASE.replace(/[^/]*$/, '') + path.replace(/^audio\//, '');
  }

  function tryLoad(i) {
    if (i >= MANIFEST_CANDIDATES.length) {
      ready = true;
      loadError = 'no manifest candidate returned valid JSON';
      console.warn(LOG, 'manifest NOT loaded —', loadError, '· audio falls back to browser speech.');
      emit('network-error', { what: 'manifest', tried: MANIFEST_CANDIDATES });
      return;
    }
    var url = MANIFEST_CANDIDATES[i];
    var t0 = Date.now();
    fetch(url, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (json) {
        if (!json || typeof json !== 'object' || !Object.keys(json).length) throw new Error('empty manifest');
        MAP = json;
        MAP_LC = {};
        for (var key in json) { if (Object.prototype.hasOwnProperty.call(json, key)) MAP_LC[normalize(key).toLowerCase()] = json[key]; }
        loadedFrom = url;
        MANIFEST_BASE = url.replace(/[^/]*$/, '');
        ready = true;
        console.info(LOG, 'manifest loaded:', Object.keys(MAP).length, 'entries from', url, '(' + (Date.now() - t0) + 'ms)');
        emit('manifest-loaded', { entries: Object.keys(MAP).length, from: url, ms: Date.now() - t0 });
        runPreloadQueue();
      })
      .catch(function () { tryLoad(i + 1); });
  }
  tryLoad(0);

  /* ── Lookup ─────────────────────────────────────────────────────────────── */
  function manifestEntry(text) {
    var n = normalize(text);
    return MAP[n] || MAP_LC[n.toLowerCase()] || MAP_LC[n.toLowerCase().replace(/[.,!?;:]+$/, '')];
  }
  function relOf(entry) { return !entry ? undefined : (typeof entry === 'string' ? entry : entry.audio); }
  function audioUrl(text) { var rel = relOf(manifestEntry(text)); return rel ? resolveUrl(rel) : undefined; }
  function dialogueInfo(text) { var e = manifestEntry(text); return (e && typeof e === 'object') ? e : undefined; }
  /** Real per-word timestamps for a sentence/dialogue, or undefined.
   *  Shape: [{ i, w, t }] where t = seconds from clip start. */
  function wordMarks(text) { var e = manifestEntry(text); return (e && typeof e === 'object' && Array.isArray(e.marks) && e.marks.length) ? e.marks : undefined; }

  /* ── Per-URL element cache (instant replays, bounded) ───────────────────── */
  var CACHE = {};          // url → HTMLAudioElement (preloaded, paused)
  var CACHE_KEYS = [];     // LRU order
  var CACHE_MAX = 64;      // plenty for a chapter; bounded so no leak

  function getCached(url) {
    if (!AudioCtor) return null;
    var el = CACHE[url];
    if (el) {
      // touch LRU
      var k = CACHE_KEYS.indexOf(url); if (k > -1) CACHE_KEYS.splice(k, 1);
      CACHE_KEYS.push(url);
      return el;
    }
    el = new AudioCtor();
    el.preload = 'auto';
    el.src = url;
    el.addEventListener('error', function () { emit('play-error', { url: url, code: el.error && el.error.code, phase: 'load' }); }, { once: true });
    CACHE[url] = el;
    CACHE_KEYS.push(url);
    // Evict oldest if over budget (never evict the one currently playing).
    while (CACHE_KEYS.length > CACHE_MAX) {
      var old = CACHE_KEYS.shift();
      if (CACHE[old] && CACHE[old] !== current) { try { CACHE[old].src = ''; } catch (e) {} delete CACHE[old]; }
      else if (CACHE[old] === current) { CACHE_KEYS.push(old); break; }
    }
    return el;
  }

  /* ── Single playback owner (no accidental overlap) ──────────────────────── */
  var current = null;
  var currentEndedHandler = null;

  function detachCurrent() {
    if (current && currentEndedHandler) {
      try { current.removeEventListener('ended', currentEndedHandler); } catch (e) {}
    }
    currentEndedHandler = null;
  }

  function stopCurrent() {
    if (current) {
      detachCurrent();
      try { current.pause(); current.currentTime = 0; } catch (e) {}
      current = null;
    }
    if (global.speechSynthesis) { try { global.speechSynthesis.cancel(); } catch (e) {} }
  }

  function ttsFallback(text, opts) {
    opts = opts || {};
    if (global.speechSynthesis && global.SpeechSynthesisUtterance) {
      try {
        stopCurrent();
        var u = new SpeechSynthesisUtterance(normalize(text));
        u.lang = opts.lang || 'de-DE';
        u.rate = opts.rate || 1;
        emit('play-start', { text: normalize(text), source: 'tts' });
        u.onend = function () { emit('play-complete', { source: 'tts' }); };
        global.speechSynthesis.speak(u);
        return 'tts';
      } catch (e) { emit('play-error', { source: 'tts', msg: e && e.message }); }
    }
    return 'none';
  }

  /**
   * Play the static MP3 for `text`. Promise<boolean> — true once playing.
   * Reuses the cached element → fast, allocation-free replays.
   */
  function playAudio(text, opts) {
    opts = opts || {};
    var norm = normalize(text);
    emit('request', { text: norm });
    var url = audioUrl(text);
    if (!url) { emit('cache-miss', { text: norm }); return Promise.resolve(false); }
    if (!AudioCtor) { console.warn(LOG, 'no Audio constructor'); return Promise.resolve(false); }

    stopCurrent();

    var cached = !!CACHE[url];
    var el = getCached(url);
    emit(cached ? 'cache-hit' : 'cache-load', { url: url });

    current = el;
    try { el.currentTime = 0; } catch (e) {}
    if (typeof opts.volume === 'number') el.volume = opts.volume;
    // FIX #7: setting playbackRate before the media has metadata is unreliable
    // on Safari/iOS (it can be ignored or reset). Apply it now AND re-apply on
    // loadedmetadata so the rate always sticks — and never let it block play().
    var wantRate = (typeof opts.rate === 'number') ? opts.rate : 1;
    try { el.playbackRate = wantRate; } catch (e) {}
    el.addEventListener('loadedmetadata', function () { try { el.playbackRate = wantRate; } catch (e) {} }, { once: true });

    // ── AUDIO DEBUG (activate with ?kwaudio=debug) ──
    if (AUDIO_DEBUG) {
      // On-screen playback monitor: started / currentTime advancing / ended.
      // Proves audible playback by showing whether currentTime actually moves.
      (function () {
        var mon = document.getElementById('kw-audio-monitor');
        if (!mon) {
          mon = document.createElement('div');
          mon.id = 'kw-audio-monitor';
          mon.style.cssText = 'position:fixed;right:16px;top:16px;z-index:99999;font-family:ui-monospace,monospace;font-size:12px;background:#0E0E10;color:#F1EFEA;padding:12px 14px;border-radius:10px;min-width:230px;box-shadow:0 8px 30px rgba(0,0,0,.4)';
          document.body.appendChild(mon);
        }
        var lastCT = -1, frozenTicks = 0, mid = null;
        function paint(state, color) {
          mon.innerHTML = '<b style="color:' + color + '">' + state + '</b>' +
            '<br>currentTime: <b>' + el.currentTime.toFixed(2) + '</b> / ' + (isFinite(el.duration) ? el.duration.toFixed(2) : '?') +
            '<br>paused: ' + el.paused + ' · muted: ' + el.muted + ' · vol: ' + el.volume +
            '<br>rate: ' + el.playbackRate + ' · readyState: ' + el.readyState +
            (frozenTicks > 3 ? '<br><span style="background:#B3261E;color:#fff;padding:2px 6px;border-radius:5px">⚠ currentTime FROZEN — environment is not outputting audio (autoplay/iframe policy)</span>' : '');
        }
        clearInterval(window.__kwMonInt);
        window.__kwMonInt = setInterval(function () {
          if (el.currentTime === lastCT && !el.paused && !el.ended) frozenTicks++; else frozenTicks = (el.currentTime !== lastCT ? 0 : frozenTicks);
          lastCT = el.currentTime;
          if (el.ended) { paint('ENDED ✓', '#3DDC84'); clearInterval(window.__kwMonInt); }
          else if (el.paused) paint('PAUSED', '#FBBC04');
          else paint(frozenTicks > 3 ? 'PLAYING (no sound)' : 'PLAYING ▶', frozenTicks > 3 ? '#FF8A80' : '#3DDC84');
        }, 150);
      })();
      var dbg = { Text: norm, URL: url, Exists: null, CanPlay: false, PlayStarted: false, Error: null };
      el.addEventListener('canplay', function () { dbg.CanPlay = true; console.log('[AUDIO] canplay', norm); }, { once: true });
      el.addEventListener('error', function () { dbg.Error = 'media error code ' + (el.error && el.error.code); console.error('[AUDIO] error', norm, dbg.Error); }, { once: true });
      el.addEventListener('ended', function () { console.log('[AUDIO] ended', norm, 'currentTime=' + el.currentTime.toFixed(2)); });
      // Real HTTP status probe — proves 200 vs 404/403/CORS.
      try {
        fetch(url, { method: 'GET' }).then(function (r) {
          dbg.Exists = r.ok;
          console.log('%c AUDIO DEBUG ', 'background:#1F4E4A;color:#fff',
            '\nText: ' + dbg.Text + '\nURL: ' + dbg.URL +
            '\nHTTP: ' + r.status + ' ' + r.statusText +
            '\nContent-Type: ' + r.headers.get('content-type') +
            '\nExists(200): ' + r.ok);
        }).catch(function (e) {
          dbg.Exists = false;
          console.error('%c AUDIO DEBUG (network/CORS FAIL) ', 'background:#B3261E;color:#fff',
            '\nText: ' + dbg.Text + '\nURL: ' + dbg.URL + '\nError: ' + e.message);
        });
      } catch (e) {}
      el._kwDbg = dbg;
    }

    if (typeof opts.onAudio === 'function') { try { opts.onAudio(el); } catch (e) {} }

    if (typeof opts.onEnded === 'function') {
      currentEndedHandler = function () { emit('play-complete', { url: url, source: 'file' }); opts.onEnded(); };
    } else {
      currentEndedHandler = function () { emit('play-complete', { url: url, source: 'file' }); };
    }
    el.addEventListener('ended', currentEndedHandler, { once: true });

    var t0 = Date.now();
    var p = el.play();
    if (p && typeof p.then === 'function') {
      emit('play-start', { url: url, source: 'file', cached: cached });
      if (AUDIO_DEBUG && el._kwDbg) el._kwDbg.PlayStarted = true;
      return p.then(function () {
        emit('play-start', { url: url, source: 'file', ttfa: Date.now() - t0, cached: cached });
        if (AUDIO_DEBUG) console.log('[AUDIO] play() RESOLVED', norm, 'currentTime=' + el.currentTime.toFixed(2) + ' rate=' + el.playbackRate);
        return true;
      }).catch(function (err) {
        emit('play-error', { url: url, name: err && err.name, msg: err && err.message });
        console.warn(LOG, 'play() rejected for', url, '→', err && err.name);
        if (AUDIO_DEBUG) console.error('[AUDIO] play() REJECTED', norm, '→', err && err.name, err && err.message);
        return false;
      });
    }
    emit('play-start', { url: url, source: 'file', cached: cached });
    return Promise.resolve(true);
  }

  function speak(text, opts) {
    return playAudio(text, opts).then(function (played) {
      return played ? 'file' : ttsFallback(text, opts);
    });
  }

  /* ── Preloading (reduce time-to-first-audio) ────────────────────────────── */
  var preloadQueue = [];
  function preload(list) {
    if (!Array.isArray(list)) list = [list];
    if (!ready) { preloadQueue = preloadQueue.concat(list); return; }
    var n = 0;
    list.forEach(function (text) {
      var url = audioUrl(text);
      if (url && !CACHE[url]) { getCached(url); n++; }   // getCached primes the element (preload=auto)
    });
    if (n) emit('preload', { count: n });
  }
  function runPreloadQueue() {
    if (preloadQueue.length) { var q = preloadQueue; preloadQueue = []; preload(q); }
  }

  /* ── Diagnostics ────────────────────────────────────────────────────────── */
  function debug() {
    var sample = Object.keys(MAP).slice(0, 3);
    console.log(LOG, 'DIAGNOSTIC', {
      version: 2,
      ready: ready,
      entries: Object.keys(MAP).length,
      cached: CACHE_KEYS.length,
      loadedFrom: loadedFrom,
      loadError: loadError,
      scriptBase: BASE,
      manifestBase: MANIFEST_BASE,
      audioCtor: !!AudioCtor,
      sampleResolved: sample.map(function (k) { return k + ' → ' + audioUrl(k); })
    });
    return loadedFrom ? 'OK: ' + Object.keys(MAP).length + ' entries, ' + CACHE_KEYS.length + ' cached'
                      : 'FAIL: manifest not loaded (' + loadError + ')';
  }

  /* ── Public API ─────────────────────────────────────────────────────────── */
  global.audioUrl = audioUrl;
  global.KW_dialogueInfo = dialogueInfo;
  global.KW_wordMarks = wordMarks;
  global.KW_playAudio = playAudio;        // Promise<boolean>
  global.KW_stopAudio = stopCurrent;
  global.KW_speak = speak;                // Promise<'file'|'tts'|'none'>
  global.KW_audioReady = function () { return ready; };
  global.KW_audioPreload = preload;
  global.KW_onAudioEvent = function (fn) { if (typeof fn === 'function') listeners.push(fn); return function () { var i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); }; };
  global.KW_audioDebug = debug;

  // Release audio on page hide so nothing leaks across navigations.
  global.addEventListener('pagehide', function () { stopCurrent(); }, { passive: true });
})(window);
