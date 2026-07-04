import React from 'react';
import { grammar, GrammarRole } from '../tokens';

type Tone = 'neutral' | 'free' | 'locked';

export interface BadgeProps {
  children: React.ReactNode;
  tone?: Tone;
  /** Optional grammar-role dot. Color carries meaning — only for role/case badges. */
  role?: GrammarRole;
  className?: string;
}

const tones: Record<Tone, string> = {
  neutral: 'bg-surface border-[rgba(14,14,16,0.09)] text-ink-secondary',
  free: 'bg-[rgba(46,125,50,0.08)] border-[rgba(46,125,50,0.2)] text-g-object',
  locked: 'bg-warm-soft border-[rgba(14,14,16,0.09)] text-ink-tertiary',
};

/** Pill / Badge — small status or role chip. */
export function Badge({ children, tone = 'neutral', role, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full text-xs font-ui font-medium tracking-[-0.005em] border ${tones[tone]} ${className}`}
    >
      {role && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: grammar[role] }}
        />
      )}
      {tone === 'free' && !role && <span className="w-1.5 h-1.5 rounded-full bg-g-object shrink-0" />}
      {children}
    </span>
  );
}

export const Pill = Badge;
export default Badge;
