import React, { useEffect } from 'react';
import { grammar } from '../tokens';
import { WordData } from './GermanWord';
import { useGermanAudio, Speed } from '../hooks/useGermanAudio';

export interface WordCardProps {
  word: WordData | null;
  onClose: () => void;
}

const SECTION_TITLE = 'text-[10.5px] font-ui font-bold tracking-[0.08em] uppercase text-ink-tertiary';

/**
 * WordCard — centered modal matching the shipped word card. Renders the 10-field
 * core plus type-specific sections: verb conjugation, adjective comparison,
 * and a collapsed Advanced (synonyms / opposites) block.
 */
export function WordCard({ word, onClose }: WordCardProps) {
  const { speak } = useGermanAudio();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!word) return null;
  const color = grammar[word.role];
  const say = (t: string, s: Speed = 1) => speak(t.replace(/^(ist|hat|am)\s+/, ''), s);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-5" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[rgba(14,14,16,0.32)]" onClick={onClose} />
      <div className="relative w-full max-w-[420px] bg-surface border border-[rgba(14,14,16,0.09)] rounded-xl shadow-modal p-7 max-h-[85vh] overflow-auto">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 text-ink-tertiary hover:text-ink-primary text-sm"
        >
          ✕
        </button>

        {/* Header: word + pron, circular audio */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-german text-[28px] font-medium leading-none" style={{ color }}>{word.de}</div>
            {word.pron && <div className="mt-1.5 text-[13px] text-ink-tertiary">sounds like <em>{word.pron}</em></div>}
          </div>
          <button
            onClick={() => say(word.de)}
            aria-label="Hear it"
            className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-white"
            style={{ background: color }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2v10l8-5z" /></svg>
          </button>
        </div>

        {/* Meaning + Hindi */}
        <div className="mt-4">
          <div className="text-lg text-ink-primary">{word.en}</div>
          {word.hi && <div className="font-hindi text-ink-secondary mt-0.5">{word.hi}</div>}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[rgba(14,14,16,0.05)]">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] uppercase text-ink-tertiary">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            {word.roleLabel || word.role}
          </span>
          {word.case && <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-ink-tertiary">{word.case} case</span>}
        </div>

        {/* Why this form? */}
        {word.why && (
          <section className="mt-5">
            <div className={SECTION_TITLE}>Why this form?</div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary" dangerouslySetInnerHTML={{ __html: word.why }} />
          </section>
        )}

        {/* Verb conjugation */}
        {word.conj && (
          <section className="mt-5">
            <div className={SECTION_TITLE}>Conjugation</div>
            <div className="grid gap-[7px] mt-2">
              {([['Präsens', word.conj.praesens, '3rd person singular'],
                 ['Präteritum', word.conj.praeteritum, 'simple past'],
                 ['Perfekt', word.conj.perfekt, 'present perfect']] as const)
                .filter(([, form]) => !!form)
                .map(([label, form, hint]) => (
                  <div key={label} className="flex items-center justify-between gap-3.5 px-3.5 py-[11px] bg-elevated rounded-md">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-ink-primary">{label}</span>
                      <span className="text-[10.5px] font-medium tracking-[0.04em] uppercase text-ink-tertiary">{hint}</span>
                    </div>
                    <button onClick={() => say(form!)} className="font-german text-lg font-medium" style={{ color }}>{form}</button>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Adjective comparison */}
        {word.compare && (
          <section className="mt-5">
            <div className={SECTION_TITLE}>Comparison</div>
            <div className="grid grid-cols-2 gap-2.5 mt-2">
              {([['Comparative', word.compare.comparative], ['Superlative', word.compare.superlative]] as const)
                .filter(([, form]) => !!form)
                .map(([label, form]) => (
                  <button key={label} onClick={() => say(form!)} className="text-left px-3.5 py-3 bg-elevated border border-[rgba(14,14,16,0.05)] rounded-md hover:-translate-y-px transition-transform">
                    <div className="text-[10.5px] font-semibold tracking-[0.04em] uppercase text-ink-tertiary mb-1">{label}</div>
                    <div className="font-german text-[19px] font-medium" style={{ color }}>{form}</div>
                  </button>
                ))}
            </div>
          </section>
        )}

        {/* Advanced (collapsed) */}
        {word.advanced && (word.advanced.synonyms?.length || word.advanced.opposites?.length) && (
          <details className="mt-5 border border-[rgba(14,14,16,0.09)] rounded-md overflow-hidden">
            <summary className="list-none cursor-pointer flex items-center justify-between px-4 py-3 text-[13px] font-semibold text-ink-secondary bg-surface hover:bg-elevated">
              <span>Advanced</span><span className="text-ink-tertiary">▾</span>
            </summary>
            <div className="px-4 pb-4 grid gap-3.5">
              {(['synonyms', 'opposites'] as const).map((k) => {
                const items = word.advanced![k];
                if (!items?.length) return null;
                return (
                  <div key={k} className="grid gap-[7px]">
                    <div className={SECTION_TITLE}>{k === 'synonyms' ? 'Synonyms' : 'Opposites'}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((it) => (
                        <span key={it} className="font-german text-sm bg-elevated border border-[rgba(14,14,16,0.05)] rounded-full px-3 py-1">{it}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        )}

        {/* Example */}
        {word.example && (
          <section className="mt-5">
            <div className={SECTION_TITLE}>Example</div>
            <p className="font-german text-ink-primary mt-1.5">{word.example}</p>
            {word.exampleEn && <p className="text-sm text-ink-tertiary mt-1">{word.exampleEn}</p>}
          </section>
        )}
      </div>
    </div>
  );
}

export default WordCard;
