/**
 * lib/audio.ts
 * ----------------------------------------------------------------------------
 * audioUrl(text) — resolve a German string to its pre-generated static MP3.
 *
 * The manifest is produced at build time by `npm run generate-audio`. Because
 * it's a plain JSON import, the lookup is synchronous, zero-latency, and fully
 * static — no browser-side TTS, ever.
 *
 * Usage (React / Next.js):
 *   import { audioUrl, playAudio } from '@/lib/audio';
 *   const url = audioUrl('Guten Morgen');   // '/audio/sentences/xyz.mp3' | undefined
 *   playAudio('Haus');                       // plays if available, no-op otherwise
 */
import manifest from '@/public/audio/manifest.json';

const MAP = manifest as Record<string, string>;

/** Same normalization the generator uses — keep in sync. */
function normalize(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .trim();
}

/** Returns the static MP3 URL for a German string, or undefined if not generated. */
export function audioUrl(text: string): string | undefined {
  if (!text) return undefined;
  return MAP[normalize(text)];
}

/** True if a static file exists for this text. */
export function hasAudio(text: string): boolean {
  return audioUrl(text) !== undefined;
}

let current: HTMLAudioElement | null = null;

/**
 * Play the static MP3 for `text`. Stops any currently-playing clip first.
 * Returns the Audio element (or null if no file exists). Mobile-safe: must be
 * called from within a user gesture (click/tap), which all call-sites are.
 */
export function playAudio(text: string): HTMLAudioElement | null {
  const url = audioUrl(text);
  if (!url) return null;
  try {
    if (current) { current.pause(); current.currentTime = 0; }
    current = new Audio(url);
    void current.play();
    return current;
  } catch {
    return null;
  }
}
