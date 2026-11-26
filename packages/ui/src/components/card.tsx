import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-md border border-line bg-surface p-3 shadow-sm', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-bold text-ink', className)} {...props} />;
}

const statTones = {
  neutral: 'bg-fill text-ink',
  brand: 'bg-brand text-ink',
  ink: 'bg-ink text-brand',
  success: 'bg-success/10 text-success',
} as const;

/** Tarjeta de indicador de los paneles ("Ocupación día 92 %", "Ingresos del mes"). */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: string;
  /** Línea secundaria: variación, detalle o desglose. */
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: keyof typeof statTones;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col gap-3 rounded-lg p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold text-muted">{label}</span>
        {icon && (
          <span
            className={cn(
              'flex size-9 shrink-0 items-center justify-center rounded-md',
              statTones[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <span className="text-3xl font-bold tracking-tight text-ink">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Card>
  );
}

/** Estado vacío de listas y tablas. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-line px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-pill bg-fill text-muted">
          {icon}
        </span>
      )}
      <p className="font-bold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

/** Bloque de carga. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-fill', className)} />;
}
