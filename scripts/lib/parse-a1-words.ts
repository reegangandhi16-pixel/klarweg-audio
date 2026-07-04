/**
 * scripts/lib/parse-a1-words.ts
 * ----------------------------------------------------------------------------
 * Parses content/a1-words.md (Klarweg A1 vocabulary by chapter) into a clean,
 * de-duplicated list of German vocabulary terms — ARTICLES PRESERVED.
 *
 * Lines look like:   - der Tisch — table
 *                    - gleich (same) — the same
 *                    - nach (+D) — to
 * We take the German side (before the em-dash) and strip trailing parenthetical
 * disambiguators like "(same)" / "(+D)" so the spoken term is clean:
 *   "der Tisch"  ·  "die Lampe"  ·  "das Haus"  ·  "gleich"  ·  "nach"
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface A1Word { term: string; chapter: number; tier: string; }

export function parseA1Words(file = 'content/a1-words.md'): A1Word[] {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8').split('\n');

  const out: A1Word[] = [];
  const seen = new Set<string>();
  let chapter = 0, tier = '';

  for (const raw of lines) {
    const line = raw.trimEnd();
    const chMatch = line.match(/^##\s+Chapter\s+(\d+)/i);
    if (chMatch) { chapter = parseInt(chMatch[1], 10); continue; }
    const tierMatch = line.match(/^\*\*(.+?)\*\*/);
    if (tierMatch) { tier = tierMatch[1].trim(); continue; }

    const item = line.match(/^-\s+(.+)$/);
    if (!item) continue;
    // German is everything before the em-dash separator " — "
    let german = item[1].split(/\s+—\s+/)[0].trim();
    // strip a trailing "(...)" disambiguator, e.g. "gleich (same)" → "gleich"
    german = german.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (!german) continue;
    // skip pure metalanguage slash-stubs that aren't speakable words
    if (/^(das\/der\/die|ein\/eine)$/i.test(german)) continue;
    const key = german.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ term: german, chapter, tier });
  }
  return out;
}
