/**
 * scripts/build-coverage-json.ts
 * ----------------------------------------------------------------------------
 * Writes public/audio/coverage.json so the static Admin dashboard
 * (admin/audio-coverage.html) can display live coverage without a server.
 * Run after generation:   npm run build-coverage
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeCoverage } from './audio-coverage.ts';

const r = analyzeCoverage();
const out = resolve(process.cwd(), 'public/audio/coverage.json');
writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), ...r }, null, 2) + '\n');
console.log(`coverage.json written — ${r.present}/${r.total} present, ${r.missing} missing`);
