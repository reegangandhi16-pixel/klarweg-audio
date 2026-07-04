/**
 * scripts/generate-a1-audio.ts
 * ----------------------------------------------------------------------------
 * Dual-voice A1 vocabulary audio generator (female + male).
 *
 *   • Source: content/a1-words.md  (articles preserved: der Tisch, die Lampe…)
 *   • Female voice: de-DE-Neural2-F  → public/audio/words/female/<hash>.mp3
 *   • Male voice:   de-DE-Neural2-D  → public/audio/words/male/<hash>.mp3
 *   • Manifest: public/audio/a1-words-manifest.json
 *        { "der Tisch": { "female": "/audio/words/female/<hash>.mp3",
 *                          "male":   "/audio/words/male/<hash>.mp3" } }
 *   • Skips files already on disk → safe to resume after interruption.
 *   • Does NOT touch sentence or dialogue audio, or the main manifest.json.
 *
 * Commands:
 *   npm run generate-a1-audio:dry     preview counts, no API calls
 *   npm run generate-a1-audio         generate missing female+male MP3s
 *   npm run generate-a1-audio:stats   report coverage from disk + manifest
 */
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { parseA1Words } from './lib/parse-a1-words.ts';

loadEnv({ path: '.env.local' });

const API_KEY = process.env.GOOGLE_TTS_API_KEY ?? '';
const VOICE_FEMALE = process.env.TTS_VOICE_FEMALE ?? 'de-DE-Neural2-F';
const VOICE_MALE = process.env.TTS_VOICE_MALE ?? 'de-DE-Neural2-D';
const LANG = 'de-DE';
const ENDPOINT = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;

const MODE = process.argv.includes('--stats') ? 'stats'
           : process.argv.includes('--dry-run') ? 'dry' : 'run';

const ROOT = resolve(process.cwd());
const WORDS_DIR = resolve(ROOT, 'public/audio/words');
const DIR_F = resolve(WORDS_DIR, 'female');
const DIR_M = resolve(WORDS_DIR, 'male');
const MANIFEST = resolve(ROOT, 'public/audio/a1-words-manifest.json');

function normalize(t: string) { return t.replace(/\s+/g, ' ').trim(); }
function hashOf(t: string) { return createHash('sha256').update(normalize(t), 'utf8').digest('hex').slice(0, 16); }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function synth(text: string, voice: string): Promise<Buffer> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: LANG, name: voice },
      audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, sampleRateHertz: 24000 },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`);
  const j = (await res.json()) as { audioContent?: string };
  if (!j.audioContent) throw new Error('no audioContent');
  return Buffer.from(j.audioContent, 'base64');
}

function loadManifest(): Record<string, { female: string; male: string }> {
  if (!existsSync(MANIFEST)) return {};
  try { return JSON.parse(readFileSync(MANIFEST, 'utf8')); } catch { return {}; }
}

async function main() {
  const words = parseA1Words();
  console.log('\n🔤  Klarweg A1 vocabulary audio (dual voice)');
  console.log(`    source: content/a1-words.md`);
  console.log(`    female: ${VOICE_FEMALE}   male: ${VOICE_MALE}`);
  console.log(`    A1 entries detected: ${words.length}`);

  mkdirSync(DIR_F, { recursive: true });
  mkdirSync(DIR_M, { recursive: true });
  const manifest = loadManifest();

  let haveF = 0, haveM = 0, needF = 0, needM = 0;
  const plan = words.map((w) => {
    const hash = hashOf(w.term);
    const fPath = resolve(DIR_F, `${hash}.mp3`), mPath = resolve(DIR_M, `${hash}.mp3`);
    const fExists = existsSync(fPath), mExists = existsSync(mPath);
    fExists ? haveF++ : needF++;
    mExists ? haveM++ : needM++;
    return { term: w.term, hash, fPath, mPath, fExists, mExists };
  });

  // STATS — report coverage from disk + manifest, no generation.
  if (MODE === 'stats') {
    console.log('\n── A1 audio coverage ───────────────');
    console.log(`Total entries:        ${words.length}`);
    console.log(`Female present/missing: ${haveF} / ${needF}`);
    console.log(`Male present/missing:   ${haveM} / ${needM}`);
    console.log(`Manifest entries:       ${Object.keys(manifest).length}`);
    console.log(`Status: ${needF === 0 && needM === 0 ? '✅ COMPLETE' : '… incomplete'}`);
    console.log('────────────────────────────────────\n');
    return;
  }

  // DRY — show how many of each will be generated, no API calls.
  if (MODE === 'dry') {
    console.log('\n── Dry run (no API calls) ──────────');
    console.log(`Female files to generate: ${needF}`);
    console.log(`Male files to generate:   ${needM}`);
    console.log(`Already present:          F ${haveF} · M ${haveM}`);
    console.log(`Total API calls if you run: ${needF + needM}`);
    console.log('────────────────────────────────────\n');
    // still refresh the manifest so URLs are present for already-generated files
    for (const p of plan) manifest[p.term] = { female: `/audio/words/female/${p.hash}.mp3`, male: `/audio/words/male/${p.hash}.mp3` };
    writeFileSync(MANIFEST, JSON.stringify(sortKeys(manifest), null, 2) + '\n');
    return;
  }

  // RUN
  if (!API_KEY) { console.error('\n❌ GOOGLE_TTS_API_KEY missing in .env.local'); process.exit(1); }
  let genF = 0, genM = 0, fail = 0;
  for (const p of plan) {
    manifest[p.term] = { female: `/audio/words/female/${p.hash}.mp3`, male: `/audio/words/male/${p.hash}.mp3` };
    try {
      if (!p.fExists) { writeFileSync(p.fPath, await synth(p.term, VOICE_FEMALE)); genF++; await sleep(110); }
      if (!p.mExists) { writeFileSync(p.mPath, await synth(p.term, VOICE_MALE)); genM++; await sleep(110); }
      if (!p.fExists || !p.mExists) console.log(`   ✓ ${p.term}`);
    } catch (e) {
      fail++;
      console.error(`   ✗ ${p.term} — ${(e as Error).message}`);
      // manifest write happens at the end → safe to resume; existing files skipped
    }
    // Persist manifest incrementally every 25 items so an interruption is safe.
    if ((genF + genM) % 25 === 0) writeFileSync(MANIFEST, JSON.stringify(sortKeys(manifest), null, 2) + '\n');
  }
  writeFileSync(MANIFEST, JSON.stringify(sortKeys(manifest), null, 2) + '\n');

  console.log(`\n📦 a1-words-manifest.json: ${Object.keys(manifest).length} entries`);
  console.log(`   generated → female: ${genF}  male: ${genM}  ·  failed: ${fail}`);
  console.log('   done.\n');
  if (fail) process.exitCode = 1;
}

function sortKeys<T>(o: Record<string, T>): Record<string, T> {
  const s: Record<string, T> = {};
  for (const k of Object.keys(o).sort((a, b) => a.localeCompare(b, 'de'))) s[k] = o[k];
  return s;
}

main().catch((e) => { console.error(e); process.exit(1); });
