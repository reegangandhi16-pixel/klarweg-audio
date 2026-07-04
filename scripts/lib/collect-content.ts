/**
 * scripts/lib/collect-content.ts
 * ----------------------------------------------------------------------------
 * Scans the Klarweg repository for German text that needs audio, and returns a
 * de-duplicated, categorized list. No network — pure file parsing.
 *
 * Categories (drive the output sub-folder):
 *   'words'      → single vocabulary items / short labels (no sentence punctuation)
 *   'sentences'  → example sentences, speaking prompts, reading passages
 *   'dialogues'  → lines spoken by a character in a dialogue
 *
 * Sources scanned (extend SOURCES as the platform grows):
 *   - chapter/chapter-data.js        (window.KW_CHAPTER: vocab, reading, speaking, …)
 *   - account/saved-words.html       (SEED vocabulary array)
 *   - klarweg-v4.html                (WORDS dictionary on the homepage)
 *   - content/audio-extra.json       (optional manual list: ["Guten Morgen", …])
 *
 * The parser deliberately uses a sandboxed `vm` eval for the JS data files
 * (they only assign a global object), and tolerant regex for HTML embeds.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

export type Category = 'words' | 'sentences' | 'dialogues';
export type Gender = 'female' | 'male';
export interface Item {
  text: string;
  category: Category;
  /** Dialogue only — speaker name + resolved gender (drives the voice). */
  speaker?: string;
  gender?: Gender;
}

/** Names known to be male; everyone else defaults to female (Neural2-F). */
const MALE_NAMES = new Set([
  'max', 'rohan', 'peter', 'thomas', 'lukas', 'felix', 'jonas', 'paul', 'david',
  'michael', 'stefan', 'markus', 'klaus', 'hans', 'jan', 'tim', 'ben', 'noah',
  'leon', 'finn', 'herr',
]);
function genderForSpeaker(name: string): Gender {
  return MALE_NAMES.has(String(name).trim().toLowerCase()) ? 'male' : 'female';
}

const ROOT = resolve(process.cwd());
const p = (rel: string) => resolve(ROOT, rel);

/** Strip HTML tags + collapse whitespace. */
function clean(s: string): string {
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Does this string contain German letters / look like real content? */
function isGerman(s: string): boolean {
  if (!s) return false;
  // must contain at least one letter; allow umlauts + ß
  if (!/[A-Za-zÀ-ÿäöüÄÖÜß]/.test(s)) return false;
  // skip pure-Devanagari (Hindi) or pure punctuation
  if (/^[\s·.,–—-]*$/.test(s)) return false;
  return true;
}

/** Heuristic: is this a single word/label rather than a sentence? */
function looksLikeWord(s: string): boolean {
  // sentence if it ends with . ! ? or contains a finite-verb-ish space run > 2 words
  const words = s.split(/\s+/);
  if (/[.!?]$/.test(s)) return false;
  if (words.length <= 2) return true;
  return false;
}

/** Safely eval a `window.X = {…}` data file and return the assigned object. */
function evalDataFile(file: string, globalName: string): any {
  const code = readFileSync(file, 'utf8');
  const sandbox: any = { window: {} };
  vm.createContext(sandbox);
  try {
    vm.runInContext(code, sandbox, { timeout: 3000 });
  } catch {
    /* tolerate — partial files still populate window before throwing */
  }
  return sandbox.window?.[globalName] ?? sandbox[globalName];
}

/* ── Source extractors ─────────────────────────────────────────────────── */

function fromChapterData(items: Item[]) {
  const file = p('chapter/chapter-data.js');
  if (!existsSync(file)) return;
  const C = evalDataFile(file, 'KW_CHAPTER');
  if (!C) return;

  // Vocabulary: the word itself + its example sentence
  for (const v of C.vocab ?? []) {
    const word = clean([v.art, v.de].filter(Boolean).join(' '));
    if (isGerman(word)) items.push({ text: word, category: 'words' });
    if (v.ex && isGerman(v.ex)) items.push({ text: clean(v.ex), category: 'sentences' });
  }

  // Reading passage: each clickable token + per-token example
  for (const t of C.reading?.tokens ?? []) {
    if (t.w && isGerman(t.w) && t.role) items.push({ text: clean(t.w), category: 'words' });
    if (t.ex && isGerman(t.ex)) items.push({ text: clean(t.ex), category: 'sentences' });
  }

  // Speaking prompts
  for (const s of C.speaking ?? []) {
    if (s.de && isGerman(s.de)) items.push({ text: clean(s.de), category: 'sentences' });
  }

  // Dialogues: C.dialogue = [{ speaker, de }] — detect the speaker → voice.
  for (const line of C.dialogue ?? C.cafe ?? []) {
    if (line.de && isGerman(line.de)) {
      const speaker = line.speaker || line.name || '';
      const gender: Gender = line.gender === 'male' || line.voice === 'male'
        ? 'male'
        : line.gender === 'female' || line.voice === 'female'
        ? 'female'
        : genderForSpeaker(speaker);
      items.push({ text: clean(line.de), category: 'dialogues', speaker, gender });
    }
  }
}

function fromSavedWordsSeed(items: Item[]) {
  const file = p('account/saved-words.html');
  if (!existsSync(file)) return;
  const html = readFileSync(file, 'utf8');
  // Pull the `var SEED = [ … ];` array out of the inline <script>.
  const m = html.match(/SEED\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return;
  let arr: any[] = [];
  try { arr = JSON.parse(m[1].replace(/'/g, '"')); } catch { return; }
  for (const w of arr) {
    if (w?.de && isGerman(w.de)) items.push({ text: clean(w.de), category: 'words' });
  }
}

function fromHomepageWords(items: Item[]) {
  const file = p('klarweg-v4.html');
  if (!existsSync(file)) return;
  const html = readFileSync(file, 'utf8');
  // WORDS dictionary: keys are lowercase ids, each value has word/example.
  const block = html.match(/(?:const|var)\s+WORDS\s*=\s*\{[\s\S]*?\n\s*\};/);
  if (!block) return;
  // Tolerant: pull `word: 'X'` and `example: 'Y'` pairs.
  for (const mm of block[0].matchAll(/word:\s*'([^']+)'/g)) {
    if (isGerman(mm[1])) items.push({ text: clean(mm[1]), category: 'words' });
  }
  for (const mm of block[0].matchAll(/example:\s*'([^']+)'/g)) {
    if (isGerman(mm[1])) items.push({ text: clean(mm[1]), category: 'sentences' });
  }
}

function fromExtraJson(items: Item[]) {
  const file = p('content/audio-extra.json');
  if (!existsSync(file)) return;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    const push = (text: string, category: Category) => {
      if (isGerman(text)) items.push({ text: clean(text), category });
    };
    // Dialogue entries support three shapes, all of which carry a speaker:
    //   "Anna: Guten Morgen!"                          (string "Name: line")
    //   { speaker: "Max", text: "Hallo!" }             (object)
    //   { speaker: "Max", text: "Hallo!", gender: "male" | "female" }
    const pushDialogue = (entry: any) => {
      let speaker = '', text = '', gender: Gender | undefined;
      if (typeof entry === 'string') {
        const m = entry.match(/^\s*([\p{L}][\p{L}\s.'-]{0,40}?)\s*:\s*(.+)$/u);
        if (m) { speaker = m[1].trim(); text = m[2].trim(); }
        else { text = entry.trim(); }
      } else if (entry && typeof entry === 'object') {
        speaker = String(entry.speaker || entry.name || '').trim();
        text = String(entry.text || entry.de || '').trim();
        if (entry.gender === 'male' || entry.voice === 'male') gender = 'male';
        else if (entry.gender === 'female' || entry.voice === 'female') gender = 'female';
      }
      if (!isGerman(text)) return;
      items.push({ text: clean(text), category: 'dialogues', speaker, gender: gender ?? genderForSpeaker(speaker) });
    };
    if (Array.isArray(data)) {
      for (const t of data) push(String(t), looksLikeWord(String(t)) ? 'words' : 'sentences');
    } else {
      for (const t of data.words ?? []) push(String(t), 'words');
      for (const t of data.sentences ?? []) push(String(t), 'sentences');
      for (const d of data.dialogues ?? []) pushDialogue(d);
    }
  } catch { /* ignore malformed */ }
}

/* ── Public API ────────────────────────────────────────────────────────── */

export function collectGermanContent(): Item[] {
  const raw: Item[] = [];
  fromChapterData(raw);
  fromSavedWordsSeed(raw);
  fromHomepageWords(raw);
  fromExtraJson(raw);

  // Re-bucket anything mis-tagged, then de-dupe by text (first category wins,
  // but a sentence beats a word if the same string shows up as both).
  const rank: Record<Category, number> = { dialogues: 3, sentences: 2, words: 1 };
  const byText = new Map<string, Item>();
  for (const it of raw) {
    if (!isGerman(it.text)) continue;
    // sanity re-bucket: multi-word with end punctuation → sentence
    const cat: Category =
      it.category === 'dialogues' ? 'dialogues'
      : looksLikeWord(it.text) ? 'words'
      : 'sentences';
    const prev = byText.get(it.text);
    if (!prev || rank[cat] > rank[prev.category]) {
      byText.set(it.text, { text: it.text, category: cat, speaker: it.speaker, gender: it.gender });
    }
  }
  return [...byText.values()].sort((a, b) => a.text.localeCompare(b.text, 'de'));
}
