'use client';

import {
  PARKING_LOT_STATUSES,
  type AdminParkingLot,
  type AdminParkingLotReviewInput,
  type ParkingLotStatus,
} from '@parqueavecino/contracts';
import { Badge, Button, EmptyState, Pill, Skeleton } from '@parqueavecino/ui';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Building2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import {
  getAdminListParkingLotsQueryKey,
  getAdminStatsQueryKey,
  useAdminListParkingLots,
  useAdminReviewParkingLot,
} from '@/lib/api/generated/admin/admin';
import { HttpError } from '@/lib/api/http';
import { routes } from '@/lib/routes';
import { LOT_STATUS_TONE } from '@/lib/status';
import { useDebouncedValue } from '@/lib/use-debounced-value';

const PAGE_SIZE = 20;

function isLotStatus(value: string | null): value is ParkingLotStatus {
  return (PARKING_LOT_STATUSES as string[]).includes(value ?? '');
}

/** Acciones posibles según el estado actual del parqueadero. */
function actionsFor(lot: AdminParkingLot): { key: string; input: AdminParkingLotReviewInput }[] {
  switch (lot.status) {
    case 'ACTIVE':
      return [
        { key: 'suspend', input: { status: 'SUSPENDED' } },
        lot.verified
          ? { key: 'removeSeal', input: { status: 'ACTIVE', verified: false } }
          : { key: 'addSeal', input: { status: 'ACTIVE', verified: true } },
      ];
    case 'SUSPENDED':
      return [
        { key: 'reactivate', input: { status: 'ACTIVE' } },
        { key: 'toReview', input: { status: 'PENDING_VERIFICATION' } },
      ];
    default:
      return [
        { key: 'approve', input: { status: 'ACTIVE', verified: true } },
        { key: 'suspend', input: { status: 'SUSPENDED' } },
      ];
  }
}

export function LotsAdmin() {
  const t = useTranslations('panel.admin.lots');
  const tStatus = useTranslations('partner.status');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const initialStatus = useSearchParams().get('status');
  const [status, setStatus] = useState<ParkingLotStatus | undefined>(
    isLotStatus(initialStatus) ? initialStatus : undefined,
  );
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(query.trim(), 300);

  const list = useAdminListParkingLots({ page, pageSize: PAGE_SIZE, q: q || undefined, status });
  const review = useAdminReviewParkingLot();

  const act = async (lot: AdminParkingLot, input: AdminParkingLotReviewInput) => {
    await review.mutateAsync({ id: lot.id, data: input });
    void queryClient.invalidateQueries({ queryKey: getAdminListParkingLotsQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getAdminStatsQueryKey() });
  };

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
        {PARKING_LOT_STATUSES.map((value) => (
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

      {review.error instanceof HttpError && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {review.error.message}
        </p>
      )}

      {list.isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : !list.data || list.data.items.length === 0 ? (
        <EmptyState icon={<Building2 aria-hidden className="size-6" />} title={t('empty')} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t('columns.lot')}</Th>
                <Th className="hidden md:table-cell">{t('columns.partner')}</Th>
                <Th className="hidden lg:table-cell">{t('columns.spots')}</Th>
                <Th>{t('columns.status')}</Th>
                <Th className="text-right">{tCommon('actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((lot) => {
                const total = lot.offers.reduce((sum, offer) => sum + offer.totalSpots, 0);
                const available = lot.offers.reduce((sum, offer) => sum + offer.availableSpots, 0);
                return (
                  <tr key={lot.id} className="transition-colors hover:bg-surface-muted">
                    <Td>
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5 font-bold">
                          {lot.name}
                          {lot.verified && (
                            <BadgeCheck aria-hidden className="size-4 text-success" />
                          )}
                        </span>
                        <span className="text-xs text-muted">
                          {[lot.address, lot.neighborhood].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <div className="flex flex-col">
                        <span>{lot.partner.fullName}</span>
                        <span className="text-xs text-muted">{lot.partner.email}</span>
                      </div>
                    </Td>
                    <Td className="hidden whitespace-nowrap text-muted lg:table-cell">
                      {t('spots', { available, total })}
                    </Td>
                    <Td>
                      <Badge tone={LOT_STATUS_TONE[lot.status]}>{tStatus(lot.status)}</Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap justify-end gap-1">
                        {actionsFor(lot).map(({ key, input }) => (
                          <Button
                            key={key}
                            size="sm"
                            variant={
                              key === 'approve' || key === 'reactivate' ? 'accent' : 'secondary'
                            }
                            disabled={review.isPending}
                            onClick={() => void act(lot, input)}
                          >
                            {t(key)}
                          </Button>
                        ))}
                        {lot.status === 'ACTIVE' && (
                          <Link
                            href={routes.parkingLot(lot.id)}
                            target="_blank"
                            aria-label={t('view')}
                            title={t('view')}
                            className="rounded-pill p-2 text-muted hover:bg-fill hover:text-ink"
                          >
                            <ExternalLink aria-hidden className="size-4" />
                          </Link>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
