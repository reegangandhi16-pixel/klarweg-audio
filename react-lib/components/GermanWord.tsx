import React from 'react';
import { grammar, GrammarRole } from '../tokens';

export type GrammarCase = 'Nominativ' | 'Akkusativ' | 'Dativ' | 'Genitiv';

export interface WordData {
  de: string;
  role: GrammarRole;
  /** Plain-English role label, e.g. "Subject", "Verb", "Article" */
  roleLabel?: string;
  case?: GrammarCase;
  pron?: string;
  en: string;
  hi?: string;
  why?: string;
  example?: string;
  exampleEn?: string;
  /** Verbs: present (3rd sing) / Präteritum / Perfekt */
  conj?: { praesens?: string; praeteritum?: string; perfekt?: string };
  /** Adjectives: comparative / superlative */
  compare?: { comparative?: string; superlative?: string };
  /** Advanced (collapsed by default) */
  advanced?: { synonyms?: string[]; opposites?: string[] };
}

export interface GermanWordProps {
  word: WordData;
  onTap?: (w: WordData, el: HTMLElement) => void;
  className?: string;
}

/**
 * GermanWord — the irreducible interaction. A role-colored, tappable German word.
 * Wire onTap to open <WordCard>. Color comes from the grammar token for the role.
 */
export function GermanWord({ word, onTap, className = '' }: GermanWordProps) {
  return (
    <span
      role="button"
      tabIndex={0}
      data-word={word.de}
      onClick={(e) => onTap?.(word, e.currentTarget)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTap?.(word, e.currentTarget as HTMLElement); }}
      className={`font-german font-medium cursor-pointer rounded-[5px] px-1 -mx-px transition-colors duration-150 hover:bg-[rgba(14,14,16,0.05)] ${className}`}
      style={{ color: grammar[word.role] }}
    >
      {word.de}
    </span>
  );
}

export default GermanWord;
