/**
 * scripts/verify-audio-coverage.ts
 * ----------------------------------------------------------------------------
 * BUILD GATE: fails (exit 1) if any referenced audio item is missing from the
 * manifest. Run in CI before deploy so a chapter can NEVER ship with missing
 * audio.   npm run verify-audio-coverage
 */
import { analyzeCoverage } from './audio-coverage.ts';

const r = analyzeCoverage();
console.log('\n── Audio coverage ───────────────');
console.log(`Total items:  ${r.total}`);
console.log(`Present:      ${r.present}`);
console.log(`Missing:      ${r.missing}`);
console.log(`Status: ${r.missing === 0 ? '✅ PASS' : '❌ FAIL'}`);
if (r.missing > 0) {
  if (r.missingWords.length)     console.log('\nMissing words:\n  ' + r.missingWords.join('\n  '));
  if (r.missingSentences.length) console.log('\nMissing sentences:\n  ' + r.missingSentences.join('\n  '));
  if (r.missingDialogues.length) console.log('\nMissing dialogues:\n  ' + r.missingDialogues.join('\n  '));
  console.log('\n→ Add them to content/audio-extra.json (or chapter data) and run `npm run generate-audio`.');
  process.exit(1);
}
console.log('────────────────────────────────\n');
