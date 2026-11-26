import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Filtro activo (p. ej. "Noche" o "Carro" en la búsqueda). */
  active?: boolean;
  /** Color cuando está activo: azul (por defecto) o amarillo de marca. */
  tone?: 'ink' | 'brand';
};

export function Pill({
  active = false,
  tone = 'ink',
  className,
  type = 'button',
  ...props
}: PillProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill border-2 px-4 py-2 text-sm font-bold transition-colors',
        active
          ? tone === 'brand'
            ? 'border-brand bg-brand text-ink'
            : 'border-ink bg-ink text-ink-contrast'
          : 'border-line bg-surface text-muted hover:border-ink hover:text-ink',
        className,
      )}
      {...props}
    />
  );
}
