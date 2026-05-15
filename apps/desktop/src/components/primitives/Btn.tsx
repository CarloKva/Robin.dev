import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type BtnVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'successSoft'
  | 'warning';

export type BtnSize = 'sm' | 'md' | 'lg';

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  full?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variantClass: Record<BtnVariant, string> = {
  primary:
    'bg-accent text-accent-ink border border-accent hover:bg-accent-hover active:translate-y-[0.5px]',
  secondary:
    'bg-panel text-ink border border-border hover:bg-hover active:translate-y-[0.5px]',
  ghost: 'bg-transparent text-ink2 hover:bg-hover',
  danger:
    'bg-danger-soft text-danger border border-danger-border hover:bg-danger hover:text-white',
  success:
    'bg-success text-white border border-success hover:bg-success/90 active:translate-y-[0.5px]',
  successSoft:
    'bg-success-soft text-success border border-success-border hover:bg-success hover:text-white',
  warning:
    'bg-warning-soft text-warning border border-warning-border hover:bg-warning hover:text-white',
};

const sizeClass: Record<BtnSize, string> = {
  sm: 'h-[26px] px-2.5 text-2xs rounded-md gap-1.5',
  md: 'h-[30px] px-3 text-xs rounded-md gap-2',
  lg: 'h-9 px-4 text-sm rounded-lg gap-2',
};

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn(
  { variant = 'primary', size = 'md', full, icon, children, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium leading-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        variantClass[variant],
        sizeClass[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon ? <span className="inline-flex shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
});
