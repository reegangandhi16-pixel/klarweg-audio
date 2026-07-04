import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface A2Word {
  term: string;
  chapter: number;
  tier: string;
}

export function parseA2Words(
  file = resolve(process.env.HOME || '', 'Downloads/klarweg-a2-all-german-words.txt')
): A2Word[] {
  if (!existsSync(file)) return [];

  const lines = readFileSync(file, 'utf8').split(/\r?\n/);

  const out: A2Word[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    const german = raw.trim();

    if (!german) continue;

    const key = german.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);

    out.push({
      term: german,
      chapter: 0,
      tier: 'A2'
    });
  }

  return out;
}