import { useCallback, useRef, useState } from 'react';

export type AudioState = 'idle' | 'loading' | 'playing';
export type Speed = 1 | 0.75 | 0.4;

/**
 * useGermanAudio — speechSynthesis wrapper matching the shipped audio state machine.
 * Always stop() before speak(); never autoplay. Prefers a clear German voice.
 */
export function useGermanAudio() {
  const [state, setState] = useState<AudioState>('idle');
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);

  const pickVoice = useCallback(() => {
    if (voiceRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const all = window.speechSynthesis.getVoices().filter(v => (v.lang || '').toLowerCase().startsWith('de'));
    // Prefer clear neural voices; exclude novelty/low-fidelity ones.
    const pref = ['conrad', 'markus', 'killian', 'florian', 'petra', 'katja', 'anna', 'helena', 'google'];
    for (const name of pref) {
      const m = all.find(v => (v.name || '').toLowerCase().includes(name));
      if (m) { voiceRef.current = m; return; }
    }
    voiceRef.current = all[0] || null;
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setState('idle');
  }, []);

  const speak = useCallback((text: string, speed: Speed = 1) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    pickVoice();
    window.speechSynthesis.cancel(); // always stop before speak
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'de-DE';
    u.rate = speed;
    if (voiceRef.current) u.voice = voiceRef.current;
    u.onstart = () => setState('playing');
    u.onend = () => setState('idle');
    u.onerror = () => setState('idle');
    setState('loading');
    window.speechSynthesis.speak(u);
  }, [pickVoice]);

  return { state, speak, stop };
}

export default useGermanAudio;
