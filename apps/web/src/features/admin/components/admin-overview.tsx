'use client';

import {
  BOOKING_STATUSES,
  PARKING_LOT_STATUSES,
  USER_ROLES,
  type BookingStatus,
  type ParkingLotStatus,
  type UserRole,
} from '@parqueavecino/contracts';
import { buttonVariants, Skeleton, StatCard } from '@parqueavecino/ui';
import { AlertTriangle, CalendarCheck, Gauge, HandCoins, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BreakdownList, PageHeader, Panel } from '@/features/panel/components/panel-ui';
import { RevenueChart } from '@/features/panel/components/revenue-chart';
import { useAdminStats } from '@/lib/api/generated/admin/admin';
import { formatPercent, formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';

const ROLE_COLOR: Record<UserRole, string> = {
  DRIVER: 'bg-ink',
  PARTNER: 'bg-brand',
  ADMIN: 'bg-muted',
};
const LOT_COLOR: Record<ParkingLotStatus, string> = {
  ACTIVE: 'bg-success',
  PENDING_VERIFICATION: 'bg-brand',
  DRAFT: 'bg-soft',
  PAUSED: 'bg-muted',
  SUSPENDED: 'bg-danger',
};
const BOOKING_COLOR: Record<BookingStatus, string> = {
  ACTIVE: 'bg-success',
  PENDING_PAYMENT: 'bg-brand',
  EXPIRED: 'bg-soft',
  CANCELLED: 'bg-muted',
  REFUNDED: 'bg-ink',
};

/** Resumen del dueño de la plataforma: ingresos, comisión, ocupación y distribución. */
export function AdminOverview() {
  const t = useTranslations('panel.admin.overview');
  const tPanel = useTranslations('panel');
  const tPartner = useTranslations('partner.status');
  const { data: stats, isLoading } = useAdminStats();

  if (isLoading || !stats) {
    return (
      <>
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </>
    );
  }

  const pendingLots = stats.parkingLots.byStatus.PENDING_VERIFICATION ?? 0;
  const commissionShare =
    stats.revenue.grossMinor > 0 ? stats.revenue.commissionMinor / stats.revenue.grossMinor : 0;

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {!stats.paymentsEnabled && (
        <p className="flex items-center gap-2 rounded-md bg-warning/10 px-4 py-3 text-sm font-bold text-warning">
          <AlertTriangle aria-hidden className="size-4" />
          {t('paymentsOff')}
        </p>
      )}

      {pendingLots > 0 && (
        <div className="flex flex-col gap-3 rounded-lg bg-ink p-5 text-ink-contrast sm:flex-row sm:items-center sm:justify-between">
          <span className="font-bold">{t('pendingLots', { count: pendingLots })}</span>
          <Link
            href={`${routes.admin.lots}?status=PENDING_VERIFICATION`}
            className={buttonVariants({ variant: 'accent', size: 'sm' })}
          >
            {t('review')}
          </Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('revenue')}
          value={formatPrice(stats.revenue.grossMinor, stats.revenue.currency)}
          icon={<Wallet aria-hidden className="size-5" />}
          tone="ink"
        />
        <StatCard
          label={t('commission')}
          value={formatPrice(stats.revenue.commissionMinor, stats.revenue.currency)}
          hint={t('commissionHint', { percent: formatPercent(commissionShare) })}
          icon={<HandCoins aria-hidden className="size-5" />}
          tone="brand"
        />
        <StatCard
          label={t('bookingsActive')}
          value={String(stats.bookings.byStatus.ACTIVE ?? 0)}
          hint={t('pendingBookings', { count: stats.bookings.byStatus.PENDING_PAYMENT ?? 0 })}
          icon={<CalendarCheck aria-hidden className="size-5" />}
          tone="success"
        />
        <StatCard
          label={t('occupancy')}
          value={formatPercent(stats.occupancy)}
          hint={t('occupancyHint')}
          icon={<Gauge aria-hidden className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title={t('chartTitle')}
          className="lg:col-span-2"
          action={
            <Link href={routes.admin.payments} className="text-sm font-bold underline">
              {t('seeAll')}
            </Link>
          }
        >
          <RevenueChart daily={stats.revenue.daily} emptyLabel={t('chartEmpty')} />
        </Panel>
        <Panel title={t('bookingsTitle')}>
          <BreakdownList
            total={stats.bookings.total}
            items={BOOKING_STATUSES.map((status) => ({
              key: status,
              label: tPanel(`bookingStatus.${status}`),
              value: stats.bookings.byStatus[status] ?? 0,
              className: BOOKING_COLOR[status],
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel
          title={`${t('usersTitle')} · ${stats.users.total}`}
          action={
            <Link href={routes.admin.users} className="text-sm font-bold underline">
              {t('seeAll')}
            </Link>
          }
        >
          <BreakdownList
            total={stats.users.total}
            items={USER_ROLES.map((role) => ({
              key: role,
              label: tPanel(`roles.${role}`),
              value: stats.users.byRole[role] ?? 0,
              className: ROLE_COLOR[role],
            }))}
          />
        </Panel>
        <Panel
          title={`${t('lotsTitle')} · ${stats.parkingLots.total}`}
          action={
            <Link href={routes.admin.lots} className="text-sm font-bold underline">
              {t('seeAll')}
            </Link>
          }
        >
          <BreakdownList
            total={stats.parkingLots.total}
            items={PARKING_LOT_STATUSES.map((status) => ({
              key: status,
              label: tPartner(status),
              value: stats.parkingLots.byStatus[status] ?? 0,
              className: LOT_COLOR[status],
            }))}
          />
        </Panel>
      </div>
    </>
  );
}
