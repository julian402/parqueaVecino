'use client';

import { PAYMENT_STATUSES, type PaymentStatus } from '@parqueavecino/contracts';
import { Badge, EmptyState, Pill, Skeleton } from '@parqueavecino/ui';
import { CreditCard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  PageHeader,
  Pagination,
  Table,
  Td,
  Th,
  Toolbar,
} from '@/features/panel/components/panel-ui';
import { useAdminListPayments } from '@/lib/api/generated/admin/admin';
import { formatDateTime, formatPrice } from '@/lib/format';
import { PAYMENT_STATUS_TONE } from '@/lib/status';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const PAGE_SIZE = 20;

/** Libro de movimientos: cada cobro de Stripe con su comisión. */
export function PaymentsAdmin() {
  const t = useTranslations('panel.admin.payments');
  const tStatus = useTranslations('panel.paymentStatus');
  const tCommon = useTranslations('common');
  const [status, setStatus] = useState<PaymentStatus | undefined>();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(query.trim(), 300);
  const list = useAdminListPayments({ page, pageSize: PAGE_SIZE, q: q || undefined, status });

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Toolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder={t('searchPlaceholder')}
      >
        <Pill active={!status} onClick={() => setStatus(undefined)}>
          {tCommon('all')}
        </Pill>
        {PAYMENT_STATUSES.map((value) => (
          <Pill
            key={value}
            active={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {tStatus(value)}
          </Pill>
        ))}
      </Toolbar>

      {list.isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : !list.data || list.data.items.length === 0 ? (
        <EmptyState icon={<CreditCard aria-hidden className="size-6" />} title={t('empty')} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t('columns.date')}</Th>
                <Th>{t('columns.driver')}</Th>
                <Th className="hidden md:table-cell">{t('columns.lot')}</Th>
                <Th className="text-right">{t('columns.amount')}</Th>
                <Th className="hidden text-right sm:table-cell">{t('columns.commission')}</Th>
                <Th>{t('columns.status')}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((payment) => (
                <tr key={payment.id} className="transition-colors hover:bg-surface-muted">
                  <Td className="whitespace-nowrap text-muted">
                    {formatDateTime(payment.createdAt)}
                  </Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-bold">{payment.booking.driverName}</span>
                      <span className="text-xs text-muted">
                        {payment.booking.plate} · {payment.booking.driverEmail}
                      </span>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <div className="flex flex-col">
                      <span>{payment.booking.parkingLotName}</span>
                      <span className="font-mono text-xs text-muted">{payment.providerRef}</span>
                    </div>
                  </Td>
                  <Td className="text-right font-bold whitespace-nowrap">
                    {formatPrice(payment.amountMinor, payment.currency)}
                  </Td>
                  <Td className="hidden text-right whitespace-nowrap text-muted sm:table-cell">
                    {formatPrice(payment.commissionMinor, payment.currency)}
                  </Td>
                  <Td>
                    <Badge tone={PAYMENT_STATUS_TONE[payment.status]}>
                      {tStatus(payment.status)}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
