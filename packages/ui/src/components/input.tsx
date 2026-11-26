import { useId, type ComponentProps } from 'react';
import { cn } from '../lib/cn';

/** Incluye `ref` (React 19), necesario para react-hook-form. */
export type InputProps = ComponentProps<'input'> & {
  label?: string;
  error?: string;
};

export function Input({ label, error, className, id, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-bold text-ink">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        className={cn(
          'rounded-md border-2 border-line bg-surface px-4 py-3 text-ink transition-colors placeholder:text-soft focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/25',
          error && 'border-danger',
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
