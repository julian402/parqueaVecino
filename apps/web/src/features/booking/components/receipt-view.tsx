'use client';

import { Badge, Button, buttonVariants, Card, EmptyState, Skeleton } from '@parqueavecino/ui';
import { ArrowLeft, Download, ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import QRCode from 'react-qr-code';
import { BrandLogo } from '@/features/layout/components/brand-logo';
import { useBookingsReceipt } from '@/lib/api/generated/bookings/bookings';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import { PAYMENT_STATUS_TONE } from '@/lib/status';

/**
 * Contenido del QR: identifica la mensualidad sin datos personales. La portería lo lee y
 * compara código y placa (el formato es estable para un futuro lector en el panel del aliado).
 */
export function qrPayload(accessCode: string, plate: string): string {
  return `PARQUEAVECINO:${accessCode}:${plate}`;
}

/** Recibo de la mensualidad con QR de ingreso. "Descargar PDF" usa la impresión del navegador. */
export function ReceiptView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('receipt');
  const tEnums = useTranslations('enums');
  const tNav = useTranslations('nav');
  const tPanel = useTranslations('panel');
  const query = useBookingsReceipt(bookingId);

  const back = (
    <Link
      href={routes.myBookings}
      className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'self-start' })}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {t('back')}
    </Link>
  );

  if (query.isLoading) return <Skeleton className="h-96 max-w-3xl rounded-xl" />;
  if (!query.data) {
    return (
      <>
        {back}
        <EmptyState
          icon={<ReceiptText aria-hidden className="size-6" />}
          title={t('notAvailable')}
        />
      </>
    );
  }

  const { number, booking, driver, payment, issuedAt } = query.data;
  const rows: [string, string][] = [
    [t('driver'), driver.fullName],
    [t('lot'), `${booking.parkingLot.name} · ${booking.parkingLot.address}`],
    [t('shift'), tEnums(`shift.${booking.shift}`)],
    [t('vehicle'), `${tEnums(`vehicleType.${booking.vehicleType}`)} · ${booking.plate}`],
    [
      t('period'),
      booking.startsAt && booking.endsAt
        ? t('periodValue', { start: formatDate(booking.startsAt), end: formatDate(booking.endsAt) })
        : '—',
    ],
    [t('paidAt'), payment.paidAt ? formatDateTime(payment.paidAt) : '—'],
    [t('method'), t('methodValue')],
    [t('reference'), payment.reference],
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        {back}
        <div className="flex flex-col items-end gap-1">
          <Button onClick={() => window.print()}>
            <Download aria-hidden className="size-4" />
            {t('print')}
          </Button>
          <span className="text-xs text-muted">{t('printHint')}</span>
        </div>
      </div>

      <Card className="flex flex-col gap-6 rounded-xl p-6 md:p-8 print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div className="flex flex-col gap-3">
            <BrandLogo alt={tNav('brand')} className="h-10 self-start" />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
              <span className="text-sm text-muted">{t('number', { number })}</span>
            </div>
          </div>
          <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>
            {tPanel(`paymentStatus.${payment.status}`)}
          </Badge>
        </header>

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <dl className="grid gap-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-6">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd className="font-bold break-words">{value}</dd>
              </div>
            ))}
          </dl>

          {booking.accessCode && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-line p-4 text-center">
              <span className="text-sm font-bold">{t('qrTitle')}</span>
              <div className="rounded-md bg-surface p-2">
                <QRCode
                  value={qrPayload(booking.accessCode, booking.plate)}
                  size={168}
                  level="M"
                  aria-label={t('accessCode')}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-widest text-muted uppercase">
                  {t('accessCode')}
                </span>
                <span className="font-mono text-xl font-bold tracking-widest">
                  {booking.accessCode}
                </span>
              </div>
              <span className="max-w-48 text-xs text-muted">{t('qrHint')}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-ink px-5 py-4 text-ink-contrast">
          <span className="font-bold">{t('total')}</span>
          <span className="text-2xl font-bold">
            {formatPrice(payment.amountMinor, payment.currency)}
          </span>
        </div>

        <footer className="flex flex-col gap-1 border-t border-line pt-4 text-xs text-muted">
          <span>{t('issuedAt', { date: formatDateTime(issuedAt) })}</span>
          <span>{driver.email}</span>
          <p>{t('legal')}</p>
        </footer>
      </Card>
    </div>
  );
}
