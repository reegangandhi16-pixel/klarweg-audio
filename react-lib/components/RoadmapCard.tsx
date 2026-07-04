import React from 'react';
import { Badge } from '../primitives/Badge';

export type Skill = 'audio' | 'speak' | 'grammar' | 'quiz' | 'pdf';

export interface ChapterMeta {
  n: number;
  title: string;
  goal: string;
  duration: string;
  skills: Skill[];
  status: 'free' | 'locked';
  href: string;
  levelCode: string;
}

const SKILL_ICON: Record<Skill, React.ReactNode> = {
  audio: <path d="M3 12C3 8 6 5 9 5V9C9 11 7 12 6 12C4 12 3 13 3 15V18C3 19 4 20 5 20H7V13M21 12C21 8 18 5 15 5V9C15 11 17 12 18 12C20 12 21 13 21 15V18C21 19 20 20 19 20H17V13" />,
  speak: <path d="M9 4h6v8a3 3 0 0 1-6 0z M6 11a6 6 0 0 0 12 0 M12 17v3" />,
  grammar: <g><circle cx="7" cy="9" r="2.5" /><circle cx="17" cy="9" r="2.5" /><circle cx="12" cy="17" r="2.5" /></g>,
  quiz: <path d="M9 9C9 7 10.5 5.5 12 5.5C13.5 5.5 15 7 15 9C15 11 12 11 12 14M12 18.5V18.6" />,
  pdf: <path d="M7 3H14L19 8V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM14 3V8H19" />,
};

const SkillDot = ({ s }: { s: Skill }) => (
  <span className="w-[22px] h-[22px] rounded-full bg-warm-soft border border-[rgba(14,14,16,0.05)] inline-flex items-center justify-center text-ink-tertiary">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{SKILL_ICON[s]}</svg>
  </span>
);

/**
 * RoadmapCard — one chapter card. Free and locked share the same template;
 * the only differences are the accent stripe (free) and lock chip (locked).
 */
export function RoadmapCard({ chapter }: { chapter: ChapterMeta }) {
  const locked = chapter.status === 'locked';
  const num = String(chapter.n).padStart(2, '0');
  return (
    <a
      href={chapter.href}
      aria-label={`Chapter ${chapter.n}: ${chapter.title}. ${locked ? 'Locked.' : 'Free.'}`}
      className={[
        'group relative bg-surface border border-[rgba(14,14,16,0.09)] rounded-md p-[22px] pb-5',
        'flex flex-col gap-3 min-h-[184px] overflow-hidden cursor-pointer w-full text-left',
        'transition-[transform,border-color,box-shadow] duration-[250ms] ease-klar',
        'hover:-translate-y-px hover:border-[rgba(14,14,16,0.18)] hover:shadow-soft',
        !locked ? "before:content-[''] before:absolute before:left-0 before:inset-y-0 before:w-[3px] before:bg-[linear-gradient(180deg,#185FA5,#EA580C)]" : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`font-mono text-xs font-medium ${locked ? 'text-ink-quaternary' : 'text-ink-tertiary'}`}>{chapter.levelCode} · {num}</span>
        {locked
          ? <span className="w-[26px] h-[26px] rounded-full bg-warm-soft border border-[rgba(14,14,16,0.09)] inline-flex items-center justify-center text-ink-tertiary"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="6" y="11" width="12" height="8" rx="1.8" /><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0" strokeLinecap="round" /></svg></span>
          : <Badge tone="free">Free chapter</Badge>}
      </div>
      <h3 className="font-display text-lg font-medium leading-tight tracking-[-0.015em] text-ink-primary">{chapter.title}</h3>
      <p className={`text-sm leading-normal flex-1 ${locked ? 'text-ink-tertiary opacity-[0.78]' : 'text-ink-secondary'}`}>{chapter.goal}</p>
      <div className="flex items-center justify-between gap-2.5 mt-2 pt-3 border-t border-[rgba(14,14,16,0.05)] flex-wrap">
        <div className="flex items-center gap-2.5 text-xs text-ink-tertiary flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="7" cy="7" r="5.3" /><path d="M7 4V7L9 8.5" strokeLinecap="round" /></svg>
            {chapter.duration}
          </span>
          <span className="flex items-center gap-1.5">{chapter.skills.slice(0, 5).map((s) => <SkillDot key={s} s={s} />)}</span>
        </div>
        <span className="text-[13px] font-medium text-ink-primary inline-flex items-center gap-1 transition-[gap] group-hover:gap-[7px]">
          {locked ? 'Unlock to begin' : 'Begin chapter'}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7H11M11 7L7 3M11 7L7 11" /></svg>
        </span>
      </div>
    </a>
  );
}

export default RoadmapCard;
