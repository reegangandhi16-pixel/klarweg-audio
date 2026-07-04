/**
 * Klarweg React + Tailwind component library — public surface.
 * Mirrors the components proven in the shipped single-HTML pages.
 */

// Tokens
export { default as tokens, surfaces, ink, accents, grammar, hairline, radius, shadow, motion, fonts, space } from './tokens';
export type { GrammarRole } from './tokens';

// Primitives
export { Button } from './primitives/Button';
export type { ButtonProps } from './primitives/Button';
export { Card } from './primitives/Card';
export type { CardProps } from './primitives/Card';
export { Badge, Pill } from './primitives/Badge';
export type { BadgeProps } from './primitives/Badge';

// Signature components
export { GermanWord } from './components/GermanWord';
export type { GermanWordProps, WordData, GrammarCase } from './components/GermanWord';
export { WordCard } from './components/WordCard';
export type { WordCardProps } from './components/WordCard';
export { RoadmapCard } from './components/RoadmapCard';
export type { ChapterMeta, Skill } from './components/RoadmapCard';
export { ChapterShell } from './components/ChapterShell';
export type { ChapterShellProps } from './components/ChapterShell';

// Hooks
export { useGermanAudio } from './hooks/useGermanAudio';
export type { AudioState, Speed } from './hooks/useGermanAudio';
export { useSavedWords } from './hooks/useSavedWords';
export type { SavedWord } from './hooks/useSavedWords';
