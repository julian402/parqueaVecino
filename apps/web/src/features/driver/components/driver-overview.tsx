'use client';

import type { Booking } from '@parqueavecino/contracts';
import { Badge, buttonVariants, EmptyState, Skeleton, StatCard } from '@parqueavecino/ui';
import { CalendarCheck, CalendarClock, Car, Search, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSession } from '@/features/auth/hooks/use-session';
import { ActiveCard } from '@/features/booking/components/my-bookings';
import { PageHeader, Panel } from '@/features/panel/components/panel-ui';
import { useBookingsList } from '@/lib/api/generated/bookings/bookings';
import { useVehiclesList } from '@/lib/api/generated/vehicles/vehicles';
import { formatDate, formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import { BOOKING_STATUS_TONE } from '@/lib/status';

const DAY_MS = 86_400_000;
const RECENT_LIMIT = 5;
/** Estados en los que el pago se cobró y no se devolvió. */
const PAID: Booking['status'][] = ['ACTIVE', 'EXPIRED'];

/** Panel del conductor: resumen de mensualidades, vencimientos y gasto. */
export function DriverOverview() {
  const t = useTranslations('panel.driver.overview');
  const tPanel = useTranslations('panel');
  const tNav = useTranslations('nav');
  const tBookings = useTranslations('bookings');
  const { user } = useSession();
  const bookings = useBookingsList();
  const vehicles = useVehiclesList();

  if (bookings.isLoading || !bookings.data) {
    return (
      <>
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </>
    );
  }

  const list = bookings.data;
  const active = list
    .filter((b) => b.status === 'ACTIVE')
    .sort((a, b) => (a.endsAt ?? '').localeCompare(b.endsAt ?? ''));
  const pending = list.filter((b) => b.status === 'PENDING_PAYMENT');
  const paid = list.filter((b) => PAID.includes(b.status));
  const currency = list[0]?.currency;
  const spentMinor = paid.reduce((sum, b) => sum + b.priceMinor, 0);
  const next = active[0];
  const daysLeft = next?.endsAt
    ? Math.max(0, Math.ceil((new Date(next.endsAt).getTime() - Date.now()) / DAY_MS))
    : null;
  const firstName = user?.fullName.trim().split(/\s+/)[0] ?? '';

  return (
    <>
      <PageHeader
        title={t('title', { name: firstName })}
        subtitle={t('subtitle')}
        actions={
          <Link href={routes.search} className={buttonVariants({ variant: 'accent' })}>
            <Search aria-hidden className="size-4" />
            {tNav('search')}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('active')}
          value={String(active.length)}
          hint={t('activeHint', { count: pending.length })}
          icon={<CalendarCheck aria-hidden className="size-5" />}
          tone="ink"
        />
        <StatCard
          label={t('nextExpiry')}
          value={
            daysLeft === null ? t('nextExpiryNone') : tBookings('daysLeft', { count: daysLeft })
          }
          hint={next?.endsAt ? t('nextExpiryHint', { date: formatDate(next.endsAt) }) : undefined}
          icon={<CalendarClock aria-hidden className="size-5" />}
          tone="brand"
        />
        <StatCard
          label={t('spent')}
          value={currency ? formatPrice(spentMinor, currency) : formatPrice(0)}
          hint={t('spentHint', { count: paid.length })}
          icon={<Wallet aria-hidden className="size-5" />}
          tone="success"
        />
        <StatCard
          label={t('vehicles')}
          value={String(vehicles.data?.length ?? 0)}
          hint={t('vehiclesHint')}
          icon={<Car aria-hidden className="size-5" />}
        />
      </div>

      {pending.map((booking) => (
        <div
          key={booking.id}
          className="flex flex-col gap-3 rounded-lg border border-brand bg-brand/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <span className="font-bold">{t('pendingTitle')}</span>
            <span className="text-sm text-muted">
              {t('pendingDetail', {
                lot: booking.parkingLot.name,
                price: formatPrice(booking.priceMinor, booking.currency),
              })}
            </span>
          </div>
          <Link
            href={routes.checkout(booking.id)}
            className={buttonVariants({ variant: 'accent', size: 'sm' })}
          >
            {tBookings('continuePayment')}
          </Link>
        </div>
      ))}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">{t('currentTitle')}</h2>
            {active.length > 0 && (
              <Link
                href={routes.myBookings}
                className="text-sm font-bold underline underline-offset-4"
              >
                {t('viewBookings')}
              </Link>
            )}
          </div>
          {next ? (
            <ActiveCard booking={next} />
          ) : (
            <EmptyState
              icon={<CalendarCheck aria-hidden className="size-6" />}
              title={t('currentEmpty')}
              description={t('currentEmptyHint')}
              action={
                <Link href={routes.search} className={buttonVariants({ variant: 'accent' })}>
                  <Search aria-hidden className="size-4" />
                  {tNav('search')}
                </Link>
              }
            />
          )}
        </section>

        <Panel
          title={t('recentTitle')}
          action={
            list.length > 0 && (
              <Link
                href={routes.driver.history}
                className="text-sm font-bold underline underline-offset-4"
              >
                {t('viewAll')}
              </Link>
            )
          }
        >
          {list.length === 0 ? (
            <p className="text-sm text-muted">{t('recentEmpty')}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {list.slice(0, RECENT_LIMIT).map((booking) => (
                <li key={booking.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-bold">{booking.parkingLot.name}</span>
                    <span className="text-xs text-muted">
                      {booking.plate} · {formatDate(booking.createdAt)} ·{' '}
                      {formatPrice(booking.priceMinor, booking.currency)}
                    </span>
                  </div>
                  <Badge tone={BOOKING_STATUS_TONE[booking.status]}>
                    {tPanel(`bookingStatus.${booking.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
