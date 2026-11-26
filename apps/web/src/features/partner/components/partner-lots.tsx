'use client';

import type { ParkingLot } from '@parqueavecino/contracts';
import { Badge, Button, Card, CardTitle, EmptyState, Skeleton } from '@parqueavecino/ui';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Building2, Pause, Pencil, Play } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/features/panel/components/panel-ui';
import {
  getPartnerParkingLotsListQueryKey,
  getPartnerSummaryQueryKey,
  usePartnerParkingLotsList,
  usePartnerParkingLotsSetStatus,
} from '@/lib/api/generated/partner/partner';
import { HttpError } from '@/lib/api/http';
import { LOT_STATUS_TONE } from '@/lib/status';
import { LotInfoDialog } from './lot-info-dialog';
import { OffersEditor } from './offers-editor';

/** Pantalla 7: el aliado edita sus parqueaderos, cupos y precios por franja. */
export function PartnerLots() {
  const t = useTranslations('partner');
  const query = usePartnerParkingLotsList();
  const lots = query.data ?? [];
  const [editing, setEditing] = useState<ParkingLot | null>(null);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {query.isLoading && <Skeleton className="h-64 rounded-lg" />}
      {!query.isLoading && lots.length === 0 && (
        <EmptyState icon={<Building2 aria-hidden className="size-6" />} title={t('empty')} />
      )}
      {lots.map((lot) => (
        <LotCard key={lot.id} lot={lot} onEdit={() => setEditing(lot)} />
      ))}
      <LotInfoDialog lot={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function LotCard({ lot, onEdit }: { lot: ParkingLot; onEdit: () => void }) {
  const t = useTranslations('partner');
  const queryClient = useQueryClient();
  const setStatus = usePartnerParkingLotsSetStatus();
  const canToggle = lot.status === 'ACTIVE' || lot.status === 'PAUSED';
  const hint =
    lot.status === 'PAUSED'
      ? t('edit.pausedHint')
      : lot.status === 'PENDING_VERIFICATION' || lot.status === 'DRAFT'
        ? t('edit.pendingHint')
        : lot.status === 'SUSPENDED'
          ? t('edit.suspendedHint')
          : null;

  const toggle = async () => {
    await setStatus.mutateAsync({
      id: lot.id,
      data: { status: lot.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' },
    });
    void queryClient.invalidateQueries({ queryKey: getPartnerParkingLotsListQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getPartnerSummaryQueryKey() });
  };

  return (
    <Card className="flex flex-col gap-5 rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{lot.name}</CardTitle>
            <Badge tone={LOT_STATUS_TONE[lot.status]}>{t(`status.${lot.status}`)}</Badge>
            {lot.verified && (
              <Badge tone="success">
                <BadgeCheck aria-hidden className="size-3.5" />
                {t('verified')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted">
            {[lot.address, lot.neighborhood, lot.city].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil aria-hidden className="size-4" />
            {t('edit.editInfo')}
          </Button>
          {canToggle && (
            <Button
              variant="secondary"
              size="sm"
              disabled={setStatus.isPending}
              onClick={() => void toggle()}
            >
              {lot.status === 'ACTIVE' ? (
                <Pause aria-hidden className="size-4" />
              ) : (
                <Play aria-hidden className="size-4" />
              )}
              {lot.status === 'ACTIVE' ? t('edit.pause') : t('edit.resume')}
            </Button>
          )}
        </div>
      </div>

      {hint && <p className="rounded-md bg-surface-muted px-4 py-3 text-sm text-muted">{hint}</p>}
      {setStatus.error instanceof HttpError && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {setStatus.error.message}
        </p>
      )}

      {/* key: al guardar llega la versión nueva del servidor y el editor se reinicia. */}
      <OffersEditor key={JSON.stringify(lot.offers)} lot={lot} />
    </Card>
  );
}
