import { useCallback, useEffect, useState } from 'react';

/**
 * useSavedWords — on-device saved-words store, shaped to mirror the backend
 * schema in account/SAVED-WORDS-BACKEND.md. Swap the localStorage body for
 * fetch() calls to wire real auth + cross-device sync later.
 */
export interface SavedWord {
  id: string;            // `${level}:${de}`
  de: string;
  en: string;
  type: 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase';
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  gender?: 'm' | 'f' | 'n' | null;
  ipa?: string | null;
  savedAt: number;
  srs?: { box: number; due: number | null; reviews: number };
}

const KEY = 'kw-saved-words';

function read(): SavedWord[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function write(list: SavedWord[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent('kw:saved-changed'));
}

export function useSavedWords() {
  const [words, setWords] = useState<SavedWord[]>([]);

  useEffect(() => {
    setWords(read());
    const sync = () => setWords(read());
    window.addEventListener('kw:saved-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('kw:saved-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const has = useCallback((id: string) => read().some((w) => w.id === id), []);

  const add = useCallback((w: Omit<SavedWord, 'id' | 'savedAt' | 'srs'> & { id?: string }) => {
    const list = read();
    const id = w.id || `${w.level}:${w.de}`;
    if (list.some((x) => x.id === id)) return false;
    write([...list, { gender: null, ipa: null, savedAt: Date.now(), srs: { box: 0, due: null, reviews: 0 }, ...w, id }]);
    return true;
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((w) => w.id !== id));
  }, []);

  const toggle = useCallback((w: Omit<SavedWord, 'id' | 'savedAt' | 'srs'> & { id?: string }) => {
    const id = w.id || `${w.level}:${w.de}`;
    if (read().some((x) => x.id === id)) { remove(id); return false; }
    add(w); return true;
  }, [add, remove]);

  const counts = useCallback(() => {
    const c: Record<string, number> = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0, total: 0 };
    read().forEach((w) => { if (c[w.level] != null) c[w.level]++; c.total++; });
    return c;
  }, []);

  return { words, has, add, remove, toggle, counts };
}

export default useSavedWords;
