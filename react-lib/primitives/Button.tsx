import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Render an arrow that nudges right on hover */
  arrow?: boolean;
  /** Render as <a> when href is provided */
  href?: string;
}

const base =
  'inline-flex items-center gap-2 font-ui font-medium tracking-[-0.005em] ' +
  'rounded-full border border-transparent cursor-pointer select-none ' +
  'min-h-[44px] transition-[transform,box-shadow,border-color,background] ' +
  'duration-150 ease-klar active:translate-y-0 disabled:opacity-45 disabled:cursor-not-allowed';

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2 text-[13px] min-h-[36px]',
  md: 'px-[22px] py-[14px] text-[15px]',
  lg: 'px-7 py-4 text-base',
};

/**
 * Variant note: the shipped homepage/CTAs use coral (#C44E26) for primary.
 * In-app/chapter surfaces use teal (--accent). Pick the variant per surface —
 * never put two accents on one surface (spec 1.5).
 */
const variants: Record<Variant, string> = {
  primary:
    'bg-coral-hover text-white hover:-translate-y-px ' +
    'hover:shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_28px_rgba(229,90,63,0.28)]',
  secondary:
    'bg-surface text-ink-primary border-[rgba(14,14,16,0.09)] ' +
    'hover:-translate-y-px hover:border-[rgba(14,14,16,0.18)] hover:shadow-soft',
  ghost:
    'bg-transparent text-ink-primary border-[rgba(14,14,16,0.18)] ' +
    'hover:bg-surface hover:border-ink-tertiary',
};

const Arrow = () => (
  <svg
    className="transition-transform duration-[250ms] ease-klar group-hover:translate-x-[3px]"
    width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
  >
    <path d="M3 7H11M11 7L7 3M11 7L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function Button({
  variant = 'primary',
  size = 'md',
  arrow = false,
  href,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const cls = `group ${base} ${sizes[size]} ${variants[variant]} ${className}`;
  const content = (
    <>
      {children}
      {arrow && <Arrow />}
    </>
  );
  if (href) {
    return (
      <a href={href} className={cls}>
        {content}
      </a>
    );
  }
  return (
    <button className={cls} {...rest}>
      {content}
    </button>
  );
}

export default Button;
