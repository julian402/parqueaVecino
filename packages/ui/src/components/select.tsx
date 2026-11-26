import { ChevronDown } from 'lucide-react';
import { useId, type ComponentProps } from 'react';
import { cn } from '../lib/cn';

export type SelectProps = ComponentProps<'select'> & {
  label?: string;
  error?: string;
};

/** Select nativo con el estilo de `Input` (accesible y cómodo en celular). */
export function Select({ label, error, className, id, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-bold text-ink">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={Boolean(error)}
          className={cn(
            'w-full appearance-none rounded-md border-2 border-line bg-surface py-3 pr-10 pl-4 text-ink transition-colors focus:border-brand focus:ring-4 focus:ring-brand/25 focus:outline-none',
            error && 'border-danger',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
        />
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
