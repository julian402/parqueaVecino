import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-md border-2 border-line bg-surface p-3', className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-bold text-ink', className)} {...props} />;
}

/** Tarjeta de indicador del panel del aliado ("Ocupación día 92 %"). */
export function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xl font-bold text-ink">{value}</span>
    </Card>
  );
}
