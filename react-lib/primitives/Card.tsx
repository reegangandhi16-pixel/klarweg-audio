import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds the warm gradient + stronger border used for "recommended"/featured surfaces */
  featured?: boolean;
  /** Adds hover-lift interaction */
  interactive?: boolean;
  as?: 'div' | 'a' | 'article';
  href?: string;
}

export function Card({
  featured = false,
  interactive = false,
  as = 'div',
  href,
  className = '',
  children,
  ...rest
}: CardProps) {
  const Tag = (href ? 'a' : as) as React.ElementType;
  const cls = [
    'relative rounded-xl p-8 border',
    featured
      ? 'bg-[linear-gradient(160deg,#FFFFFF_0%,#FFF8EC_100%)] border-[rgba(14,14,16,0.18)] shadow-card'
      : 'bg-surface border-[rgba(14,14,16,0.09)]',
    interactive
      ? 'transition-[transform,box-shadow,border-color] duration-[250ms] ease-klar cursor-pointer hover:-translate-y-1 hover:shadow-lift hover:border-[rgba(14,14,16,0.18)]'
      : '',
    className,
  ].join(' ');
  return (
    <Tag className={cls} href={href} {...rest}>
      {children}
    </Tag>
  );
}

export default Card;
