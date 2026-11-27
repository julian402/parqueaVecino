'use client';

import { Badge, buttonVariants, EmptyState, Skeleton, StatCard } from '@parqueavecino/ui';
import { Building2, CalendarCheck, Gauge, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSession } from '@/features/auth/hooks/use-session';
import { PageHeader, Panel } from '@/features/panel/components/panel-ui';
import { RevenueChart } from '@/features/panel/components/revenue-chart';
import { OccupancyChart } from '@/features/partner/components/occupancy-chart';
import { usePartnerSummary } from '@/lib/api/generated/partner/partner';
import { formatDate, formatPercent, formatPrice } from '@/lib/format';
import { SHIFT_ICONS } from '@/lib/icons';
import { routes } from '@/lib/routes';
import { BOOKING_STATUS_TONE } from '@/lib/status';

/** Pantalla 7 del mockup: KPIs del aliado, ventas y últimas mensualidades. */
export function PartnerOverview() {
  const t = useTranslations('panel.partner.overview');
  const tPanel = useTranslations('panel');
  const tEnums = useTranslations('enums');
  const { user } = useSession();
  const { data, isLoading } = usePartnerSummary();
  const firstName = user?.fullName.split(' ')[0] ?? '';

  const header = (
    <PageHeader
      title={t('title', { name: firstName })}
      subtitle={t('subtitle')}
      actions={
        <Link href={routes.partner.lots} className={buttonVariants({ variant: 'secondary' })}>
          <Building2 aria-hidden className="size-4" />
          {t('manageLots')}
        </Link>
      }
    />
  );

  if (isLoading || !data) {
    return (
      <>
        {header}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </>
    );
  }

  const sold = data.totalSpots - data.availableSpots;
  const occupancy = data.totalSpots > 0 ? sold / data.totalSpots : 0;

  return (
    <>
      {header}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('income')}
          value={formatPrice(data.revenue.netMinor, data.revenue.currency)}
          hint={t('incomeHint', {
            gross: formatPrice(data.revenue.grossMinor, data.revenue.currency),
            commission: formatPrice(data.revenue.commissionMinor, data.revenue.currency),
          })}
          icon={<Wallet aria-hidden className="size-5" />}
          tone="ink"
        />
        <StatCard
          label={t('activeBookings')}
          value={String(data.bookings.active)}
          hint={t('pendingBookings', { count: data.bookings.pending })}
          icon={<CalendarCheck aria-hidden className="size-5" />}
          tone="success"
        />
        <StatCard
          label={t('occupancy')}
          value={formatPercent(occupancy)}
          hint={t('occupancyHint', { sold, total: data.totalSpots })}
          icon={<Gauge aria-hidden className="size-5" />}
          tone="brand"
        />
        <StatCard
          label={t('lots')}
          value={String(data.lots)}
          hint={t('lotsHint', { count: data.totalSpots })}
          icon={<Building2 aria-hidden className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title={t('chartTitle')} className="lg:col-span-3">
          <RevenueChart daily={data.revenue.daily} emptyLabel={t('chartEmpty')} />
        </Panel>
        <Panel title={t('recentTitle')} className="lg:col-span-2">
          {data.recentBookings.length === 0 ? (
            <EmptyState
              icon={<CalendarCheck aria-hidden className="size-6" />}
              title={t('recentEmpty')}
              className="py-8"
            />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {data.recentBookings.map((booking) => {
                const Icon = SHIFT_ICONS[booking.shift];
                return (
                  <li key={booking.id} className="flex items-center gap-3 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-fill">
                      <Icon aria-hidden className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-bold">{booking.driverName}</span>
                      <span className="truncate text-xs text-muted">
                        {booking.plate} · {tEnums(`shift.${booking.shift}`)} ·{' '}
                        {booking.parkingLot.name} · {formatDate(booking.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold whitespace-nowrap">
                        {formatPrice(booking.priceMinor, booking.currency)}
                      </span>
                      <Badge tone={BOOKING_STATUS_TONE[booking.status]}>
                        {tPanel(`bookingStatus.${booking.status}`)}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={t('occupancyTitle')}>
        <OccupancyChart />
      </Panel>
    </>
  );
}
