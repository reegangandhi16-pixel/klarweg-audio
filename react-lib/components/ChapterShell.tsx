import React from 'react';

export interface ChapterShellProps {
  level: string;          // e.g. "A1 · Phase 1"
  chapterNumber: number;
  title: string;          // German title
  titleEn?: string;
  xp: number;
  minutes: number;
  difficulty: string;
  /** 0–100 */
  progress: number;
  nav: { id: string; label: string; done?: boolean }[];
  activeSection?: string;
  onNavigate?: (id: string) => void;
  children: React.ReactNode;
}

/**
 * ChapterShell — the chapter dashboard frame: top bar, header with progress ring,
 * and a sticky section nav. Drop section content as children.
 * In-app surface → primary actions are TEAL (--accent), not coral.
 */
export function ChapterShell({
  level, chapterNumber, title, titleEn, xp, minutes, difficulty,
  progress, nav, activeSection, onNavigate, children,
}: ChapterShellProps) {
  const R = 33, C = 2 * Math.PI * R;
  return (
    <div className="bg-canvas min-h-screen">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-4">
        <a href="/" className="font-display font-bold text-[19px] tracking-[-0.02em]">Klarweg</a>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold bg-surface border border-[rgba(14,14,16,0.09)] px-3.5 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-coral" /> {xp} XP
        </span>
      </header>

      {/* Header */}
      <div className="bg-surface border-b border-[rgba(14,14,16,0.09)] pt-24 pb-8">
        <div className="max-w-[1180px] mx-auto px-8">
          <div className="text-[11px] font-mono tracking-[0.15em] uppercase text-ink-tertiary mb-4">{level} · Chapter {chapterNumber}</div>
          <div className="flex items-start justify-between gap-8 flex-wrap">
            <div>
              <h1 className="font-display text-[clamp(30px,3.4vw,44px)] font-semibold tracking-[-0.02em]"><em className="not-italic font-german italic">{title}</em></h1>
              {titleEn && <p className="text-ink-secondary mt-2.5">{titleEn}</p>}
              <div className="flex gap-7 mt-5 text-sm text-ink-tertiary">
                <span>{minutes} min</span><span>{difficulty}</span>
              </div>
            </div>
            {/* Progress ring */}
            <div className="relative w-[76px] h-[76px] shrink-0">
              <svg className="-rotate-90" width="76" height="76">
                <circle cx="38" cy="38" r={R} className="fill-none stroke-[rgba(14,14,16,0.09)]" strokeWidth="7" />
                <circle cx="38" cy="38" r={R} className="fill-none stroke-coral-hover transition-[stroke-dashoffset] duration-[400ms]" strokeWidth="7" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress / 100)} />
              </svg>
              <div className="absolute inset-0 grid place-items-center font-display text-lg font-semibold">{progress}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky section nav */}
      <nav className="sticky top-0 z-30 bg-canvas border-b border-[rgba(14,14,16,0.05)]">
        <div className="max-w-[1180px] mx-auto px-8 flex gap-1 overflow-x-auto py-2 [scrollbar-width:none]">
          {nav.map((item) => {
            const active = item.id === activeSection;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.id)}
                className={[
                  'shrink-0 text-sm font-medium px-4 py-2 rounded-full whitespace-nowrap inline-flex items-center gap-2 transition-colors',
                  active ? 'bg-ink-primary text-canvas' : 'text-ink-secondary hover:bg-elevated hover:text-ink-primary',
                ].join(' ')}
              >
                <span className={`w-[15px] h-[15px] rounded-full grid place-items-center text-[9px] border ${item.done ? 'bg-g-object border-g-object text-white' : 'border-[rgba(14,14,16,0.18)]'}`}>{item.done ? '✓' : ''}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="max-w-[1180px] mx-auto px-8 pb-32">{children}</main>
    </div>
  );
}

export default ChapterShell;
