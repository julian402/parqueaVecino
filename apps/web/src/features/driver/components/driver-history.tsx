'use client';

import type { Booking } from '@parqueavecino/contracts';
import { Badge, buttonVariants, EmptyState, Skeleton } from '@parqueavecino/ui';
import { History, ReceiptText } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PageHeader, Table, Td, Th } from '@/features/panel/components/panel-ui';
import { useBookingsList } from '@/lib/api/generated/bookings/bookings';
import { formatDate, formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';
import { BOOKING_STATUS_TONE } from '@/lib/status';

/** Estados con un pago cobrado (el reembolsado conserva su soporte). */
const HAS_RECEIPT: Booking['status'][] = ['ACTIVE', 'EXPIRED', 'REFUNDED'];

/** Historial completo de mensualidades y pagos del conductor. */
export function DriverHistory() {
  const t = useTranslations('panel.driver.history');
  const tPanel = useTranslations('panel');
  const tEnums = useTranslations('enums');
  const list = useBookingsList();
  const bookings = list.data ?? [];

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {list.isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : bookings.length === 0 ? (
        <EmptyState icon={<History aria-hidden className="size-6" />} title={t('empty')} />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t('columns.date')}</Th>
              <Th>{t('columns.lot')}</Th>
              <Th className="hidden md:table-cell">{t('columns.shift')}</Th>
              <Th className="hidden sm:table-cell">{t('columns.plate')}</Th>
              <Th className="hidden lg:table-cell">{t('columns.period')}</Th>
              <Th className="text-right">{t('columns.amount')}</Th>
              <Th>{t('columns.status')}</Th>
              <Th className="text-right">{t('columns.receipt')}</Th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id} className="transition-colors hover:bg-surface-muted">
                <Td className="whitespace-nowrap text-muted">{formatDate(booking.createdAt)}</Td>
                <Td>
                  <div className="flex min-w-0 flex-col">
                    <span className="font-bold">{booking.parkingLot.name}</span>
                    <span className="text-xs text-muted">{booking.parkingLot.address}</span>
                  </div>
                </Td>
                <Td className="hidden md:table-cell">{tEnums(`shift.${booking.shift}`)}</Td>
                <Td className="hidden font-mono sm:table-cell">{booking.plate}</Td>
                <Td className="hidden whitespace-nowrap text-muted lg:table-cell">
                  {booking.startsAt && booking.endsAt
                    ? `${formatDate(booking.startsAt)} – ${formatDate(booking.endsAt)}`
                    : '—'}
                </Td>
                <Td className="text-right font-bold whitespace-nowrap">
                  {formatPrice(booking.priceMinor, booking.currency)}
                </Td>
                <Td>
                  <Badge tone={BOOKING_STATUS_TONE[booking.status]}>
                    {tPanel(`bookingStatus.${booking.status}`)}
                  </Badge>
                </Td>
                <Td className="text-right">
                  {HAS_RECEIPT.includes(booking.status) && (
                    <Link
                      href={routes.driver.receipt(booking.id)}
                      aria-label={t('columns.receipt')}
                      title={t('columns.receipt')}
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      <ReceiptText aria-hidden className="size-4" />
                    </Link>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
