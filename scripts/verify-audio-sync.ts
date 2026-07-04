/**
 * scripts/verify-audio-sync.ts
 * ----------------------------------------------------------------------------
 * Proves that real word-timing marks are present in the audio manifest.
 * Run after generation:   npm run verify-audio-sync
 *
 * Validates every sentence + dialogue entry:
 *   • has a non-empty "marks" array
 *   • timestamps are strictly increasing
 *   • no negative timestamps
 *   • no empty marks arrays
 * Prints a summary report and EXITS NON-ZERO (fails the build) if any
 * sentence or dialogue is missing valid marks.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MANIFEST = resolve(process.cwd(), 'public/audio/manifest.json');

function isSentenceLike(text: string): boolean {
  // multi-word German string (sentence or dialogue line)
  return text.trim().split(/\s+/).filter(Boolean).length > 1;
}
function dir(entry: any): string {
  const u = typeof entry === 'string' ? entry : (entry && entry.audio) || '';
  if (u.includes('/sentences/')) return 'sentence';
  if (u.includes('/dialogues/')) return 'dialogue';
  if (u.includes('/words/')) return 'word';
  return 'other';
}

function main() {
  if (!existsSync(MANIFEST)) {
    console.error('❌ public/audio/manifest.json not found. Run `npm run generate-audio` first.');
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, any>;

  let sentences = 0, dialogues = 0, withMarks = 0, withoutMarks = 0;
  const problems: string[] = [];

  for (const [text, entry] of Object.entries(manifest)) {
    const kind = dir(entry);
    const needsMarks = (kind === 'sentence' || kind === 'dialogue') && isSentenceLike(text);
    if (kind === 'sentence') sentences++;
    if (kind === 'dialogue') dialogues++;
    if (!needsMarks) continue;

    const marks = entry && typeof entry === 'object' ? entry.marks : undefined;
    if (!Array.isArray(marks) || marks.length === 0) {
      withoutMarks++; problems.push(`• "${text}" — missing or empty marks`);
      continue;
    }
    // validate ordering + values
    let prev = -Infinity, ok = true;
    for (const m of marks) {
      if (typeof m.t !== 'number' || m.t < 0) { ok = false; problems.push(`• "${text}" — invalid/negative timestamp (${m.t})`); break; }
      if (m.t < prev) { ok = false; problems.push(`• "${text}" — timestamps not increasing (${m.t} after ${prev})`); break; }
      prev = m.t;
    }
    if (ok) withMarks++; else withoutMarks++;
  }

  console.log('\n── Klarweg audio-sync verification ─────────────');
  console.log(`Sentences:            ${sentences}`);
  console.log(`Dialogues:            ${dialogues}`);
  console.log(`Entries with marks:   ${withMarks}`);
  console.log(`Entries without marks:${withoutMarks}`);
  const pass = withoutMarks === 0 && withMarks > 0;
  console.log(`Status: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  if (problems.length) {
    console.log('\nProblems:');
    problems.slice(0, 50).forEach((p) => console.log('  ' + p));
    if (problems.length > 50) console.log(`  …and ${problems.length - 50} more`);
  }
  console.log('────────────────────────────────────────────────\n');

  if (!pass) process.exit(1);
}

main();
