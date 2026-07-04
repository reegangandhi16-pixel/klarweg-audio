/**
 * Klarweg Design Tokens — single source of truth for the React component library.
 * Mirrors the CSS custom properties in the shipped HTML pages (klarweg OS Part 4–7).
 * Consumed by tailwind.config.js and available at runtime for inline/JS usage.
 */

export const surfaces = {
  canvas: '#FAFAF7',
  surface: '#FFFFFF',
  warm: '#FFF8EC',
  warmSoft: '#FFFCF4',
  elevated: '#F4F3EE',
} as const;

export const ink = {
  primary: '#0E0E10',
  secondary: '#3A3A40',
  tertiary: '#7A7A80',
  quaternary: '#A5A5AC',
} as const;

export const accents = {
  /** Deep teal — primary/in-app actions + Can-Do markers (spec 3.7) */
  accent: '#1F4E4A',
  accentBright: '#2E6F69',
  /** Coral — conversion CTAs only. One accent per surface. */
  coral: '#E55A3F',
  coralHover: '#C44E26',
  coralDeep: '#993C1D',
} as const;

/**
 * The 51-color grammar system. Color carries grammatical meaning ONLY —
 * never use these in decoration (backgrounds, icons, dividers).
 */
export const grammar = {
  // Spine 5
  subject: '#185FA5',
  verb: '#DC2626',
  object: '#2E7D32',
  time: '#7C3AED',
  place: '#EA580C',
  // Cases
  akkusativ: '#10B981',
  dativ: '#5C7A1D',
  genitiv: '#A06B2C',
  // Modifiers
  modalverb: '#9F1239',
  article: '#B45309',
  preposition: '#CA8A04',
  negation: '#C026D3',
  adjective: '#F59E0B',
  adverb: '#06B6D4',
  question: '#EC4899',
  // Aliases
  pronoun: '#185FA5',
} as const;

export type GrammarRole = keyof typeof grammar;

export const hairline = {
  light: 'rgba(14, 14, 16, 0.05)',
  base: 'rgba(14, 14, 16, 0.09)',
  strong: 'rgba(14, 14, 16, 0.18)',
} as const;

export const radius = {
  xs: '6px',
  sm: '10px',
  md: '14px',
  lg: '20px',
  xl: '24px',
  full: '999px',
} as const;

export const shadow = {
  soft: '0 1px 2px rgba(64, 40, 10, 0.04), 0 4px 12px rgba(64, 40, 10, 0.05)',
  card: '0 1px 3px rgba(64, 40, 10, 0.05), 0 8px 24px rgba(64, 40, 10, 0.06)',
  lift: '0 24px 60px -24px rgba(14,14,16,0.18)',
  modal: '0 2px 8px rgba(64, 40, 10, 0.08), 0 24px 64px rgba(64, 40, 10, 0.12)',
} as const;

export const motion = {
  fast: '150ms',
  base: '250ms',
  slow: '400ms',
  xl: '600ms',
  ease: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeSoft: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const fonts = {
  display: "'Fraunces', Georgia, serif",
  ui: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  german: "'Fraunces', Georgia, serif",
  mono: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
  hindi: "'Noto Sans Devanagari', 'Inter', sans-serif",
} as const;

/** Spacing scale (binding). Off-scale values (18, 50) are forbidden. */
export const space = [4, 8, 12, 16, 24, 36, 48, 64, 80, 96, 120] as const;

export const tokens = {
  surfaces, ink, accents, grammar, hairline, radius, shadow, motion, fonts, space,
};

export default tokens;
