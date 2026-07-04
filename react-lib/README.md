# Klarweg — React + Tailwind Component Library

A typed component set mirroring the components proven in the shipped single-HTML
pages. **The shipped pages stay single-HTML/vanilla per the Klarweg OS** — this
library exists so future chapter/level pages can be built faster in a React app
(Next.js etc.). It is a handoff package, not a runtime dependency of the live site.

## Install / wire up

1. Copy `react-lib/` into your app (e.g. `src/klarweg/`).
2. Extend Tailwind with the Klarweg theme:

   ```js
   // tailwind.config.js
   const { klarwegTheme } = require('./src/klarweg/tailwind.config');
   module.exports = {
     content: ['./src/**/*.{ts,tsx}'],
     theme: { extend: klarwegTheme },
   };
   ```

3. Load the fonts (Fraunces, Inter, JetBrains Mono, Noto Sans Devanagari) — see
   any shipped page `<head>` for the exact Google Fonts link.
4. Import from the barrel:

   ```tsx
   import { Button, WordCard, GermanWord, RoadmapCard, useGermanAudio } from './klarweg';
   ```

## What's inside

| File | Export | Purpose |
|---|---|---|
| `tokens.ts` | `tokens`, `grammar`, … | Design tokens (surfaces, ink, 51-color grammar, radii, shadows, motion, fonts). Single source of truth. |
| `tailwind.config.js` | `klarwegTheme` | Tailwind theme extension — `bg-canvas`, `text-g-subject`, `font-german`, `shadow-card`, etc. |
| `primitives/Button.tsx` | `Button` | `primary` (coral CTA) / `secondary` / `ghost`, sizes, hover arrow. |
| `primitives/Card.tsx` | `Card` | Surface card; `featured` (warm gradient) + `interactive` (hover-lift). |
| `primitives/Badge.tsx` | `Badge`, `Pill` | Status/role chips; pass `role` for a grammar-colored dot. |
| `components/GermanWord.tsx` | `GermanWord` | The irreducible interaction — a role-colored, tappable word. |
| `components/WordCard.tsx` | `WordCard` | Centered modal: 10-field core + verb conjugation / adjective comparison / collapsed Advanced. |
| `components/RoadmapCard.tsx` | `RoadmapCard` | One chapter card (free vs locked share one template). |
| `components/ChapterShell.tsx` | `ChapterShell` | Chapter dashboard frame: top bar, progress ring, sticky section nav. |
| `hooks/useGermanAudio.ts` | `useGermanAudio` | speechSynthesis state machine (`idle\|loading\|playing`), clear German voice, Slow/Very-slow speeds. |
| `hooks/useSavedWords.ts` | `useSavedWords` | On-device saved-words store, shaped like the backend schema. |

## Non-negotiable design rules (enforced by the tokens, not just docs)

- **Color carries grammatical meaning only.** The `grammar` tokens are for word
  coloring, role badges, and case pills — never decoration (backgrounds, icons,
  dividers).
- **One accent per surface.** Homepage/marketing = coral CTAs. In-app chapter =
  teal (`accent`) actions. Never both on one surface.
- **Warm light canvas** (`#FAFAF7`), never pure white, never dark-by-default.
- **Calm motion.** Hover = `translateY(-1px)` + soft shadow, never `scale()`.
  Respect `prefers-reduced-motion`. No streaks, confetti, or celebration motion.

## Minimal example

```tsx
import { useState } from 'react';
import { GermanWord, WordCard, WordData } from './klarweg';

const mann: WordData = {
  de: 'Mann', role: 'subject', roleLabel: 'Subject', case: 'Nominativ',
  pron: 'mahn', en: 'man', hi: 'आदमी',
  why: 'The one doing the action — subject in the nominative.',
  example: 'Der Mann liest ein Buch.', exampleEn: 'The man reads a book.',
};

export function Demo() {
  const [open, setOpen] = useState<WordData | null>(null);
  return (
    <p className="font-german text-2xl">
      Der <GermanWord word={mann} onTap={setOpen} /> liest ein Buch.
      <WordCard word={open} onClose={() => setOpen(null)} />
    </p>
  );
}
```

## Notes & scope

- Components are **presentational + light state** (audio, saved-words). They do not
  bundle a router, data fetching, or auth — wire those in your app.
- Styling assumes Tailwind with `klarwegTheme` extended. Class strings reference
  custom color/shadow/radius names defined there.
- `WordCard` covers verbs (conjugation), adjectives (comparison), and the Advanced
  (synonyms/opposites) block; nouns show core fields only — same logic as the
  shipped pages.
- TypeScript-only; no build output is included. Compile with your app's toolchain.
