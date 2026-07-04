/**
 * scripts/generate-audio.ts
 * ----------------------------------------------------------------------------
 * Build-time German audio generator for Klarweg.
 *
 *   • Reads GOOGLE_TTS_API_KEY + TTS_VOICE from .env.local
 *   • Scans the repo for German words / sentences / dialogues
 *   • Hashes each text with SHA-256 → <hash>.mp3 (stable filename)
 *   • Calls the Google Cloud Text-to-Speech REST API (MP3 output)
 *   • Writes files into public/audio/{words,sentences,dialogues}
 *   • Skips anything that already exists on disk (incremental — generate once)
 *   • Writes public/audio/manifest.json  →  { "Haus": "/audio/words/<hash>.mp3" }
 *
 * Usage:
 *   npm run generate-audio            # generate only what's missing
 *   npm run generate-audio:force      # re-generate everything
 *   npm run generate-audio:dry        # list what WOULD be generated, no API calls
 *
 * No runtime/browser TTS: the app only ever plays these static MP3s.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import { collectGermanContent, type Category, type Item, type Gender } from './lib/collect-content.ts';

loadEnv({ path: '.env.local' });

/* ── Config ────────────────────────────────────────────────────────────── */
const API_KEY = process.env.GOOGLE_TTS_API_KEY ?? '';
// Default / female voice (vocab + sentences keep using this — unchanged).
const VOICE = process.env.TTS_VOICE ?? 'de-DE-Neural2-F';
// Per-speaker dialogue voices.
const VOICE_FEMALE = process.env.TTS_VOICE_FEMALE ?? VOICE ?? 'de-DE-Neural2-F';
const VOICE_MALE = process.env.TTS_VOICE_MALE ?? 'de-DE-Neural2-B';
const LANG = VOICE.split('-').slice(0, 2).join('-'); // de-DE
const ENDPOINT = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;

/** The voice id used for a given item (dialogues vary by speaker gender). */
function voiceFor(item: Item): string {
  if (item.category === 'dialogues') {
    return item.gender === 'male' ? VOICE_MALE : VOICE_FEMALE;
  }
  return VOICE;
}

const FORCE = process.argv.includes('--force');
const DRY = process.argv.includes('--dry-run');

const ROOT = resolve(process.cwd());
const AUDIO_ROOT = resolve(ROOT, 'public/audio');
const MANIFEST_PATH = resolve(AUDIO_ROOT, 'manifest.json');
const SUBDIR: Record<Category, string> = {
  words: 'words',
  sentences: 'sentences',
  dialogues: 'dialogues',
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** Normalize text so identical content always maps to the same hash/file. */
function normalize(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim();
}

/** SHA-256(normalized text [+ voice]) → first 16 hex chars.
 *  Dialogue hashes include the voice so the SAME line spoken by a male and a
 *  female speaker produce two distinct files. Words/sentences hash by text
 *  only — so their EXISTING filenames never change (no regeneration). */
function hashOf(text: string, voice?: string): string {
  const key = voice ? `${normalize(text)}::${voice}` : normalize(text);
  return createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 16);
}

function publicUrl(category: Category, hash: string): string {
  return `/audio/${SUBDIR[category]}/${hash}.mp3`;
}

function diskPath(category: Category, hash: string): string {
  return resolve(AUDIO_ROOT, SUBDIR[category], `${hash}.mp3`);
}

function ensureDirs() {
  for (const sub of Object.values(SUBDIR)) {
    mkdirSync(resolve(AUDIO_ROOT, sub), { recursive: true });
  }
}

function loadManifest(): Record<string, string> {
  if (!existsSync(MANIFEST_PATH)) return {};
  try { return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')); } catch { return {}; }
}

/** Call Google Cloud TTS REST → returns MP3 bytes (in the given voice). */
async function synthesize(text: string, voice: string = VOICE): Promise<Buffer> {
  const body = {
    input: { text },
    voice: { languageCode: LANG, name: voice },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
      pitch: 0.0,
      sampleRateHertz: 24000,
    },
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`TTS ${res.status} ${res.statusText} — ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) throw new Error('TTS response had no audioContent');
  return Buffer.from(json.audioContent, 'base64');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Escape text for inclusion in SSML. */
function ssmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Synthesize WITH real word-level timepoints (Google SSML <mark> + enableTimePointing).
 * Wraps each whitespace-separated token with a <mark> immediately before it, so
 * the returned timepoints give the real spoken start time of every word.
 * Returns { audio, marks:[{ i, w, t }] } where t is seconds from clip start.
 * German special chars (ä ö ü ß) pass through unchanged inside SSML text.
 */
async function synthesizeWithMarks(text: string, voice: string): Promise<{ audio: Buffer; marks: Array<{ i: number; w: string; t: number }> }> {
  const tokens = normalize(text).split(' ').filter(Boolean);
  const ssml =
    '<speak>' +
    tokens.map((tok, i) => `<mark name="w${i}"/>${ssmlEscape(tok)} `).join('') +
    '</speak>';
  const body = {
    input: { ssml },
    voice: { languageCode: LANG, name: voice },
    audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0.0, sampleRateHertz: 24000 },
    enableTimePointing: ['SSML_MARK'],
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`TTS(marks) ${res.status} ${res.statusText} — ${detail.slice(0, 200)}`);
  }
  const json = (await res.json()) as { audioContent?: string; timepoints?: Array<{ markName: string; timeSeconds: number }> };
  if (!json.audioContent) throw new Error('TTS response had no audioContent');
  const marks = (json.timepoints || []).map((tp) => {
    const i = parseInt(tp.markName.replace(/^w/, ''), 10);
    return { i, w: tokens[i] || '', t: Math.round(tp.timeSeconds * 1000) / 1000 };
  }).sort((a, b) => a.t - b.t);
  return { audio: Buffer.from(json.audioContent, 'base64'), marks };
}

/* ── Main ──────────────────────────────────────────────────────────────── */

async function main() {
  console.log('\n🎙️  Klarweg audio generation');
  console.log(`    voice (default/female): ${VOICE}`);
  console.log(`    dialogue female: ${VOICE_FEMALE}  ·  dialogue male: ${VOICE_MALE}`);

  if (!DRY && !API_KEY) {
    console.error('\n❌ GOOGLE_TTS_API_KEY is missing. Add it to .env.local (see .env.example).');
    process.exit(1);
  }

  ensureDirs();

  const items: Item[] = collectGermanContent();
  console.log(`    found ${items.length} unique German strings to voice\n`);

  // Manifest values are:
  //   words/sentences  → string URL                      (UNCHANGED format)
  //   dialogues        → { text, speaker, voice, audio }  (rich object)
  // Mixed-value map keeps old entries byte-identical so nothing regenerates.
  const manifest: Record<string, any> = {};
  const prev = loadManifest();

  let generated = 0, skipped = 0, failed = 0;

  for (const item of items) {
    const { text, category } = item;
    const norm = normalize(text);
    const isDialogue = category === 'dialogues';
    // Sentences AND dialogues are multi-word → get real word timepoints for
    // highlight sync. Single vocab words don't need marks.
    const wantMarks = (category === 'sentences' || category === 'dialogues') && norm.split(' ').filter(Boolean).length > 1;
    const voice = voiceFor(item);
    // Words/sentences: hash by text only → existing filenames preserved.
    // Dialogues: hash by text+voice → per-speaker files.
    const hash = isDialogue ? hashOf(norm, voice) : hashOf(norm);
    const url = publicUrl(category, hash);
    const file = diskPath(category, hash);

    // Carry forward existing marks (so a re-run that skips the MP3 keeps them).
    const prevEntry: any = prev[norm];
    const prevMarks = prevEntry && typeof prevEntry === 'object' ? prevEntry.marks : undefined;

    if (isDialogue || wantMarks) {
      manifest[norm] = { text: norm, audio: url };
      if (isDialogue) { manifest[norm].speaker = item.speaker || ''; manifest[norm].voice = voice; }
      if (prevMarks) manifest[norm].marks = prevMarks;
    } else {
      manifest[norm] = url;
    }

    const exists = existsSync(file);
    if (exists && !FORCE) {
      skipped++;
      continue;
    }

    if (DRY) {
      console.log(`   + ${category.padEnd(9)}${wantMarks ? ' ⏱' : ''} ${isDialogue ? `[${item.speaker || '?'} · ${voice}] ` : ''}${url}   ${norm}`);
      generated++;
      continue;
    }

    try {
      if (wantMarks) {
        const { audio, marks } = await synthesizeWithMarks(norm, voice);
        writeFileSync(file, audio);
        manifest[norm] = Object.assign(manifest[norm] || { text: norm, audio: url }, { marks });
        generated++;
        console.log(`   ✓ ${category.padEnd(9)} ⏱${marks.length} ${isDialogue ? `[${item.speaker || '?'}] ` : ''}${norm}`);
      } else {
        const mp3 = await synthesize(norm, voice);
        writeFileSync(file, mp3);
        generated++;
        console.log(`   ✓ ${category.padEnd(9)} ${norm}`);
      }
      await sleep(120);
    } catch (err) {
      failed++;
      console.error(`   ✗ ${norm} — ${(err as Error).message}`);
      if (prev[norm]) manifest[norm] = prev[norm];
    }
  }

  if (!DRY) {
    // Stable, sorted manifest for clean git diffs.
    const sorted: Record<string, any> = {};
    for (const k of Object.keys(manifest).sort((a, b) => a.localeCompare(b, 'de'))) {
      sorted[k] = manifest[k];
    }
    writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
  }

  console.log(`\n📦 manifest: ${Object.keys(manifest).length} entries`);
  console.log(`   generated: ${generated}  ·  skipped (cached): ${skipped}  ·  failed: ${failed}`);
  console.log(DRY ? '   (dry run — no files written)\n' : '   done.\n');

  // ── Post-generation validation: every sentence/dialogue MUST have marks ──
  if (!DRY) {
    let sCount = 0, dCount = 0, withMarks = 0, withoutMarks = 0;
    const missing: string[] = [];
    for (const [text, entry] of Object.entries(manifest)) {
      const u = typeof entry === 'string' ? entry : (entry && (entry as any).audio) || '';
      const isSentence = u.includes('/sentences/');
      const isDialogue = u.includes('/dialogues/');
      if (isSentence) sCount++;
      if (isDialogue) dCount++;
      const multiWord = text.trim().split(/\s+/).filter(Boolean).length > 1;
      if ((isSentence || isDialogue) && multiWord) {
        const m = entry && typeof entry === 'object' ? (entry as any).marks : undefined;
        if (Array.isArray(m) && m.length) withMarks++; else { withoutMarks++; missing.push(text); }
      }
    }
    console.log('── Marks validation ─────────────');
    console.log(`Sentences: ${sCount}`);
    console.log(`Dialogues: ${dCount}`);
    console.log(`Entries with marks: ${withMarks}`);
    console.log(`Entries without marks: ${withoutMarks}`);
    console.log(`Status: ${withoutMarks === 0 ? 'PASS' : 'FAIL'}`);
    if (withoutMarks > 0) {
      console.error('\n❌ Missing marks for:');
      missing.slice(0, 30).forEach((t) => console.error('   • ' + t));
      if (missing.length > 30) console.error(`   …and ${missing.length - 30} more`);
      process.exitCode = 1;
    }
  }

  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
