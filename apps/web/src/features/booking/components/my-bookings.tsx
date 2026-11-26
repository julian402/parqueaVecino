'use client';

import type { Booking } from '@parqueavecino/contracts';
import { Badge, Button, buttonVariants, Card, EmptyState, Skeleton } from '@parqueavecino/ui';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, MapPin, QrCode, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/features/panel/components/panel-ui';
import {
  getBookingsListQueryKey,
  useBookingsCancel,
  useBookingsList,
  useBookingsRenew,
} from '@/lib/api/generated/bookings/bookings';
import { HttpError } from '@/lib/api/http';
import { formatDate, formatPrice } from '@/lib/format';
import { SHIFT_ICONS } from '@/lib/icons';
import { routes } from '@/lib/routes';
import { BOOKING_STATUS_TONE } from '@/lib/status';

const DAY_MS = 86_400_000;

export function ActiveCard({
  booking,
  renewal,
  onCancel,
  onRenew,
  renewing = false,
}: {
  booking: Booking;
  /** Renovación pendiente de pago o ya pagada de esta mensualidad. */
  renewal?: Booking | null;
  onCancel?: () => void;
  onRenew?: () => void;
  renewing?: boolean;
}) {
  const t = useTranslations('bookings');
  const tEnums = useTranslations('enums');
  const ShiftIcon = SHIFT_ICONS[booking.shift];
  const now = Date.now();
  const start = booking.startsAt ? new Date(booking.startsAt).getTime() : now;
  const end = booking.endsAt ? new Date(booking.endsAt).getTime() : now;
  const scheduled = start > now;
  const progress = Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY_MS));
  const renewedActive = renewal?.status === 'ACTIVE';

  return (
    <Card className="flex flex-col gap-5 overflow-hidden rounded-xl p-0">
      <div className="flex flex-col gap-4 bg-ink p-5 text-ink-contrast sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-lg font-bold">{booking.parkingLot.name}</span>
          <span className="inline-flex items-center gap-1 text-sm text-soft">
            <MapPin aria-hidden className="size-4" />
            {booking.parkingLot.address}
          </span>
        </div>
        <div className="flex flex-col sm:items-end">
          <span className="text-xs font-bold tracking-widest text-brand uppercase">
            {t('accessCode')}
          </span>
          <span className="font-mono text-2xl font-bold tracking-widest">{booking.accessCode}</span>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-5 pb-5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="brand">
            <ShiftIcon aria-hidden className="size-3.5" />
            {tEnums(`shift.${booking.shift}`)}
          </Badge>
          <Badge>{booking.plate}</Badge>
          {booking.renewalOfId && <Badge tone="ink">{t('renewalBadge')}</Badge>}
          {scheduled && <Badge tone="warning">{t('scheduled')}</Badge>}
          {renewedActive && renewal.endsAt && (
            <Badge tone="success">
              <RefreshCw aria-hidden className="size-3.5" />
              {t('renewedUntil', { date: formatDate(renewal.endsAt) })}
            </Badge>
          )}
          <span className="ml-auto font-bold">
            {formatPrice(booking.priceMinor, booking.currency)}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-2 overflow-hidden rounded-pill bg-fill">
            <div className="h-full rounded-pill bg-brand" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted">
            {booking.endsAt && <span>{t('validUntil', { date: formatDate(booking.endsAt) })}</span>}
            <span className="font-bold text-ink">
              {scheduled && booking.startsAt
                ? t('startsOn', { date: formatDate(booking.startsAt) })
                : t('daysLeft', { count: daysLeft })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={routes.driver.receipt(booking.id)}
            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
          >
            <QrCode aria-hidden className="size-4" />
            {t('receipt')}
          </Link>
          {onRenew && !renewedActive && !booking.renewalOfId && (
            <Button variant="accent" size="sm" disabled={renewing} onClick={onRenew}>
              <RefreshCw aria-hidden className="size-4" />
              {renewing ? t('renewing') : renewal ? t('continueRenewal') : t('renew')}
            </Button>
          )}
          {onCancel && (
            <Button variant="ghost" size="sm" className="ml-auto text-danger" onClick={onCancel}>
              {t('cancel')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Pantalla 6 del mockup: mensualidades activas, pendientes e historial. */
export function MyBookings() {
  const t = useTranslations('bookings');
  const tPanel = useTranslations('panel');
  const tNav = useTranslations('nav');
  const queryClient = useQueryClient();
  const list = useBookingsList();
  const cancel = useBookingsCancel();
  const renew = useBookingsRenew();
  const router = useRouter();
  const [confirming, setConfirming] = useState<string | null>(null);

  const doCancel = async (id: string) => {
    await cancel.mutateAsync({ id });
    setConfirming(null);
    void queryClient.invalidateQueries({ queryKey: getBookingsListQueryKey() });
  };

  const doRenew = async (id: string) => {
    const result = await renew.mutateAsync({ id });
    router.push(routes.checkout(result.booking.id));
  };

  const bookings = list.data ?? [];
  // Renovación abierta (pendiente o pagada) de cada mensualidad.
  const renewalOf = new Map(
    bookings
      .filter((b) => b.renewalOfId && (b.status === 'ACTIVE' || b.status === 'PENDING_PAYMENT'))
      .map((b) => [b.renewalOfId, b]),
  );
  const active = bookings.filter((b) => b.status === 'ACTIVE');
  const pending = bookings.filter((b) => b.status === 'PENDING_PAYMENT');
  const history = bookings.filter((b) => b.status !== 'ACTIVE' && b.status !== 'PENDING_PAYMENT');

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {renew.error instanceof HttpError && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {renew.error.message}
        </p>
      )}
      {cancel.error instanceof HttpError && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {cancel.error.message}
        </p>
      )}

      {list.isLoading ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck aria-hidden className="size-6" />}
          title={t('empty')}
          description={t('emptyHint')}
          action={
            <Link href={routes.search} className={buttonVariants({ variant: 'accent' })}>
              <Search aria-hidden className="size-4" />
              {tNav('search')}
            </Link>
          }
        />
      ) : (
        <>
          {active.map((booking) =>
            confirming === booking.id ? (
              <Card key={booking.id} className="flex flex-col gap-4 rounded-xl p-5">
                <p className="text-sm">{t('cancelConfirm')}</p>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(null)}>
                    {t('keep')}
                  </Button>
                  <Button
                    size="sm"
                    className="border-danger bg-danger hover:bg-danger/90"
                    disabled={cancel.isPending}
                    onClick={() => void doCancel(booking.id)}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              </Card>
            ) : (
              <ActiveCard
                key={booking.id}
                booking={booking}
                renewal={renewalOf.get(booking.id) ?? null}
                onCancel={() => setConfirming(booking.id)}
                onRenew={() => void doRenew(booking.id)}
                renewing={renew.isPending && renew.variables.id === booking.id}
              />
            ),
          )}

          {pending.map((booking) => (
            <Card
              key={booking.id}
              className="flex flex-col gap-3 rounded-lg p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <span className="font-bold">{booking.parkingLot.name}</span>
                <span className="text-sm text-muted">
                  {booking.plate} · {formatPrice(booking.priceMinor, booking.currency)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="warning">{tPanel('bookingStatus.PENDING_PAYMENT')}</Badge>
                <Link
                  href={routes.checkout(booking.id)}
                  className={buttonVariants({ variant: 'accent', size: 'sm' })}
                >
                  {t('continuePayment')}
                </Link>
              </div>
            </Card>
          ))}

          {history.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">{t('history')}</h2>
              <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-surface">
                {history.map((booking) => (
                  <li key={booking.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex flex-col">
                      <span className="font-bold">{booking.parkingLot.name}</span>
                      <span className="text-xs text-muted">
                        {booking.plate} · {formatDate(booking.createdAt)}
                      </span>
                    </div>
                    <Badge tone={BOOKING_STATUS_TONE[booking.status]}>
                      {tPanel(`bookingStatus.${booking.status}`)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
