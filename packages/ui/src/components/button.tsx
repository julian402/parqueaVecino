import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-pill border-2 border-ink font-bold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-ink-contrast shadow-sm hover:bg-ink/90',
        secondary: 'bg-surface text-ink hover:bg-fill',
        accent: 'border-brand bg-brand text-ink shadow-md shadow-brand/30 hover:bg-brand-strong',
        /** Sobre fondos oscuros (bandas azules). */
        inverse:
          'border-ink-contrast bg-transparent text-ink-contrast hover:bg-ink-contrast hover:text-ink',
        ghost: 'border-transparent bg-transparent text-ink hover:bg-fill',
      },
      size: {
        sm: 'px-3.5 py-1.5 text-xs',
        md: 'px-5 py-2.5 text-sm',
        lg: 'px-7 py-3.5 text-base',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({
  className,
  variant,
  size,
  block,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    />
  );
}
