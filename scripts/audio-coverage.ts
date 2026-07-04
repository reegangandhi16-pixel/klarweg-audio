/**
 * scripts/audio-coverage.ts
 * ----------------------------------------------------------------------------
 * Shared coverage analyzer: cross-checks every German string the app needs
 * (collected from chapter data + extras) against the generated manifest.json.
 * Used by both verify-audio-coverage (build gate) and the admin dashboard.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectGermanContent, type Category } from './lib/collect-content.ts';

export interface CoverageItem { text: string; category: Category; present: boolean; path?: string; }
export interface CoverageReport {
  total: number; present: number; missing: number;
  missingWords: string[]; missingSentences: string[]; missingDialogues: string[];
  items: CoverageItem[];
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').trim();
}

export function analyzeCoverage(): CoverageReport {
  const manifestPath = resolve(process.cwd(), 'public/audio/manifest.json');
  const manifest: Record<string, any> = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  // Build a normalized lookup (case-insensitive, punctuation-trimmed) like the runtime.
  const lc: Record<string, string> = {};
  for (const [k, v] of Object.entries(manifest)) {
    const url = typeof v === 'string' ? v : (v && v.audio) || '';
    lc[normalize(k).toLowerCase()] = url;
    lc[normalize(k).toLowerCase().replace(/[.,!?;:]+$/, '')] = url;
  }
  const resolveUrl = (t: string): string | undefined => {
    const n = normalize(t);
    const direct = manifest[n];
    if (direct) return typeof direct === 'string' ? direct : direct.audio;
    return lc[n.toLowerCase()] || lc[n.toLowerCase().replace(/[.,!?;:]+$/, '')];
  };

  const items: CoverageItem[] = collectGermanContent().map((it) => {
    const path = resolveUrl(it.text);
    return { text: it.text, category: it.category, present: !!path, path };
  });

  const missing = items.filter((i) => !i.present);
  return {
    total: items.length,
    present: items.length - missing.length,
    missing: missing.length,
    missingWords: missing.filter((i) => i.category === 'words').map((i) => i.text),
    missingSentences: missing.filter((i) => i.category === 'sentences').map((i) => i.text),
    missingDialogues: missing.filter((i) => i.category === 'dialogues').map((i) => i.text),
    items,
  };
}
