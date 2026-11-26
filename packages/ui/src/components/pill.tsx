import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Filtro activo (p. ej. "Noche" o "Carro" en la búsqueda). */
  active?: boolean;
};

export function Pill({ active = false, className, type = 'button', ...props }: PillProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border-[1.5px] px-3 py-1 text-xs',
        active ? 'border-ink bg-ink text-ink-contrast' : 'border-muted bg-surface text-muted',
        className,
      )}
      {...props}
    />
  );
}
