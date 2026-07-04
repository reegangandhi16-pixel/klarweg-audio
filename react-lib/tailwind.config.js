/**
 * Tailwind theme extension for Klarweg.
 * Usage in a consuming app's tailwind.config.js:
 *
 *   const { klarwegTheme } = require('./react-lib/tailwind.config');
 *   module.exports = { theme: { extend: klarwegTheme }, content: [...] };
 *
 * Then classes like `bg-canvas`, `text-ink-secondary`, `text-g-subject`,
 * `rounded-md`, `shadow-card`, `font-german` are available.
 */
const klarwegTheme = {
  colors: {
    canvas: '#FAFAF7',
    surface: '#FFFFFF',
    warm: '#FFF8EC',
    'warm-soft': '#FFFCF4',
    elevated: '#F4F3EE',
    ink: {
      DEFAULT: '#0E0E10',
      primary: '#0E0E10',
      secondary: '#3A3A40',
      tertiary: '#7A7A80',
      quaternary: '#A5A5AC',
    },
    accent: { DEFAULT: '#1F4E4A', bright: '#2E6F69' },
    coral: { DEFAULT: '#E55A3F', hover: '#C44E26', deep: '#993C1D' },
    // Grammar system — prefix g- to keep them clearly "meaning" colors.
    g: {
      subject: '#185FA5',
      verb: '#DC2626',
      object: '#2E7D32',
      time: '#7C3AED',
      place: '#EA580C',
      akkusativ: '#10B981',
      dativ: '#5C7A1D',
      genitiv: '#A06B2C',
      modalverb: '#9F1239',
      article: '#B45309',
      preposition: '#CA8A04',
      negation: '#C026D3',
      adjective: '#F59E0B',
      adverb: '#06B6D4',
      question: '#EC4899',
    },
  },
  fontFamily: {
    display: ['Fraunces', 'Georgia', 'serif'],
    ui: ['Inter', 'system-ui', 'sans-serif'],
    german: ['Fraunces', 'Georgia', 'serif'],
    mono: ['JetBrains Mono', 'SF Mono', 'Menlo', 'monospace'],
    hindi: ['Noto Sans Devanagari', 'Inter', 'sans-serif'],
  },
  borderRadius: {
    xs: '6px', sm: '10px', md: '14px', lg: '20px', xl: '24px', full: '999px',
  },
  boxShadow: {
    soft: '0 1px 2px rgba(64, 40, 10, 0.04), 0 4px 12px rgba(64, 40, 10, 0.05)',
    card: '0 1px 3px rgba(64, 40, 10, 0.05), 0 8px 24px rgba(64, 40, 10, 0.06)',
    lift: '0 24px 60px -24px rgba(14,14,16,0.18)',
    modal: '0 2px 8px rgba(64, 40, 10, 0.08), 0 24px 64px rgba(64, 40, 10, 0.12)',
  },
  transitionTimingFunction: {
    klar: 'cubic-bezier(0.22, 1, 0.36, 1)',
  },
};

module.exports = { klarwegTheme };
