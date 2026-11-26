'use client';

import type { DailyRevenue } from '@parqueavecino/contracts';
import { cn } from '@parqueavecino/ui';
import { useFormatter } from 'next-intl';
import { formatPrice } from '@/lib/format';

/**
 * Barras de ingresos por día. Hechas con CSS (sin librería de gráficas) y colores de los tokens.
 * El día más reciente va en amarillo; el detalle de cada barra sale en su tooltip.
 */
export function RevenueChart({
  daily,
  emptyLabel,
  className,
}: {
  daily: DailyRevenue[];
  emptyLabel: string;
  className?: string;
}) {
  const format = useFormatter();
  const max = Math.max(0, ...daily.map((day) => day.grossMinor));
  const total = daily.reduce((sum, day) => sum + day.grossMinor, 0);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <span className="text-2xl font-bold tracking-tight">{formatPrice(total)}</span>
      {max === 0 ? (
        <p className="flex h-44 items-center justify-center rounded-md bg-surface-muted text-sm text-muted">
          {emptyLabel}
        </p>
      ) : (
        <div className="flex h-44 items-end gap-1.5 sm:gap-2" role="list">
          {daily.map((day, index) => {
            const date = new Date(`${day.date}T12:00:00`);
            const isLast = index === daily.length - 1;
            const label = `${format.dateTime(date, { day: 'numeric', month: 'short' })}: ${formatPrice(day.grossMinor)}`;
            return (
              <div
                key={day.date}
                role="listitem"
                title={label}
                aria-label={label}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-sm bg-fill">
                  <div
                    className={cn(
                      'w-full rounded-sm transition-all group-hover:opacity-80',
                      isLast ? 'bg-brand' : 'bg-ink',
                    )}
                    style={{ height: `${Math.max(2, (day.grossMinor / max) * 100)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs text-muted',
                    index % 2 === 1 && !isLast && 'invisible sm:visible',
                  )}
                >
                  {format.dateTime(date, { day: 'numeric' })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
