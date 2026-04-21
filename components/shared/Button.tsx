'use client';

import { useState } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

function getVariantStyle(variant: Variant, hover: boolean): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        background: hover ? 'var(--amber-hover)' : 'var(--amber)',
        color: '#0A0A0B',
        border: 'none',
        boxShadow: hover ? 'var(--amber-glow)' : undefined,
      };
    case 'secondary':
      return {
        background: hover ? 'var(--amber-soft)' : 'transparent',
        color: hover ? 'var(--amber-hover)' : 'var(--amber)',
        border: '1px solid var(--amber)',
      };
    case 'ghost':
      return {
        background: hover ? 'var(--amber-soft)' : 'transparent',
        color: hover ? 'var(--amber-hover)' : 'var(--amber)',
        border: 'none',
      };
    case 'danger':
      return {
        background: hover ? '#F8717111' : 'transparent',
        color: 'var(--red)',
        border: '1px solid #F8717155',
      };
  }
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  fullWidth,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-all ' +
        SIZES[size] +
        (fullWidth ? ' w-full' : '') +
        (isDisabled ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer') +
        ' ' +
        className
      }
      style={{
        fontFamily: "'Space Grotesk', sans-serif",
        ...getVariantStyle(variant, hover && !isDisabled),
      }}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
