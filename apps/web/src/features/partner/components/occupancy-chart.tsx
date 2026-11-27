'use client';

import type { PartnerOccupancy } from '@parqueavecino/contracts';
import { cn, Skeleton } from '@parqueavecino/ui';
import { useTranslations } from 'next-intl';
import { usePartnerAnalyticsOccupancy } from '@/lib/api/generated/partner/partner';
import { formatHour, formatPercent } from '@/lib/format';

/** Cada cuántas horas se rotula el eje (todas en escritorio; cada 3 en celular). */
const MOBILE_LABEL_STEP = 3;

/**
 * Ocupación promedio por hora del día (últimos 7 días), en barras CSS con colores de los tokens.
 * La hora pico va en amarillo; el detalle de cada barra sale en su tooltip.
 */
export function OccupancyChart({ days = 7 }: { days?: number }) {
  const t = useTranslations('panel.partner.overview');
  const { data, isLoading } = usePartnerAnalyticsOccupancy({ days });

  if (isLoading || !data) return <Skeleton className="h-56 rounded-md" />;
  return <OccupancyBars data={data} emptyLabel={t('occupancyEmpty')} />;
}

function OccupancyBars({ data, emptyLabel }: { data: PartnerOccupancy; emptyLabel: string }) {
  const t = useTranslations('panel.partner.overview');
  const peak = data.peakHour === null ? undefined : data.hours[data.peakHour];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-2xl font-bold tracking-tight">
          {t('occupancyAverage', { rate: formatPercent(data.averageRate) })}
        </span>
        {peak && (
          <span className="text-sm text-muted">
            {t('occupancyPeak', { hour: formatHour(peak.hour), rate: formatPercent(peak.rate) })}
          </span>
        )}
      </div>
      {peak === undefined ? (
        <p className="flex h-44 items-center justify-center rounded-md bg-surface-muted px-4 text-center text-sm text-muted">
          {emptyLabel}
        </p>
      ) : (
        <div className="flex h-44 items-end gap-0.5 sm:gap-1" role="list">
          {data.hours.map((entry) => {
            const isPeak = entry.hour === peak.hour;
            const label = t('occupancyBar', {
              hour: formatHour(entry.hour),
              rate: formatPercent(entry.rate),
              occupied: entry.occupied.toFixed(1),
              capacity: Math.round(entry.capacity),
            });
            return (
              <div
                key={entry.hour}
                role="listitem"
                title={label}
                aria-label={label}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
              >
                <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-sm bg-fill">
                  <div
                    className={cn(
                      'w-full rounded-sm transition-all group-hover:opacity-80',
                      isPeak ? 'bg-brand' : 'bg-ink',
                    )}
                    style={{ height: `${Math.max(entry.rate > 0 ? 2 : 0, entry.rate * 100)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs text-muted',
                    entry.hour % MOBILE_LABEL_STEP !== 0 && 'invisible md:visible',
                  )}
                >
                  {entry.hour}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
