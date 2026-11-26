'use client';

import {
  SHIFTS,
  VEHICLE_TYPES,
  type OfferInput,
  type ParkingLot,
  type Shift,
  type VehicleType,
} from '@parqueavecino/contracts';
import { Button, Input, Select, cn } from '@parqueavecino/ui';
import { fromMinorUnits, toMinorUnits } from '@parqueavecino/utils';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { env } from '@/env';
import {
  getPartnerParkingLotsListQueryKey,
  getPartnerSummaryQueryKey,
  usePartnerParkingLotsUpsertOffers,
} from '@/lib/api/generated/partner/partner';
import { HttpError } from '@/lib/api/http';
import { SHIFT_ICONS, VEHICLE_ICONS } from '@/lib/icons';

type Row = {
  shift: Shift;
  vehicleType: VehicleType;
  totalSpots: number;
  /** En unidades mayores (pesos) para escribirlo cómodo; se convierte al guardar. */
  price: number;
  active: boolean;
  sold: number;
  isNew: boolean;
};

const keyOf = (row: { shift: Shift; vehicleType: VehicleType }) =>
  `${row.shift}:${row.vehicleType}`;

function rowsFrom(lot: ParkingLot): Row[] {
  return lot.offers.map((offer) => ({
    shift: offer.shift,
    vehicleType: offer.vehicleType,
    totalSpots: offer.totalSpots,
    price: fromMinorUnits(offer.monthlyPriceMinor, offer.currency),
    active: offer.active,
    sold: offer.totalSpots - offer.availableSpots,
    isNew: false,
  }));
}

/** Cupos y precios por franja: el aliado sube o baja cupos, cambia precios y oculta franjas. */
export function OffersEditor({ lot }: { lot: ParkingLot }) {
  const t = useTranslations('partner');
  const tEnums = useTranslations('enums');
  const queryClient = useQueryClient();
  const currency = lot.offers[0]?.currency ?? env.NEXT_PUBLIC_APP_CURRENCY;
  const initial = rowsFrom(lot);
  const [rows, setRows] = useState<Row[]>(initial);
  const [saved, setSaved] = useState(false);
  const upsert = usePartnerParkingLotsUpsertOffers();

  const used = new Set(rows.map(keyOf));
  const free = SHIFTS.flatMap((shift) =>
    VEHICLE_TYPES.map((vehicleType) => ({ shift, vehicleType })),
  ).filter((combo) => !used.has(keyOf(combo)));
  const [draft, setDraft] = useState(free[0]);
  const draftValid = draft && !used.has(keyOf(draft));
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial);

  const patch = (index: number, change: Partial<Row>) => {
    setSaved(false);
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...change } : row)));
  };

  const add = () => {
    const combo = draftValid ? draft : free[0];
    if (!combo) return;
    setSaved(false);
    setRows((current) => [
      ...current,
      { ...combo, totalSpots: 1, price: 0, active: true, sold: 0, isNew: true },
    ]);
    setDraft(free.find((c) => keyOf(c) !== keyOf(combo)));
  };

  const save = async () => {
    const offers: OfferInput[] = rows.map((row) => ({
      shift: row.shift,
      vehicleType: row.vehicleType,
      totalSpots: row.totalSpots,
      monthlyPriceMinor: toMinorUnits(row.price, currency),
      active: row.active,
    }));
    await upsert.mutateAsync({ id: lot.id, data: { offers } });
    setSaved(true);
    void queryClient.invalidateQueries({ queryKey: getPartnerParkingLotsListQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getPartnerSummaryQueryKey() });
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-bold">{t('offersTitle')}</h3>

      {rows.length === 0 && <p className="text-sm text-muted">{t('noOffers')}</p>}

      <ul className="flex flex-col gap-3">
        {rows.map((row, index) => {
          const ShiftIcon = SHIFT_ICONS[row.shift];
          const VehicleIcon = VEHICLE_ICONS[row.vehicleType];
          const freeAfter = Math.max(0, row.totalSpots - row.sold);
          return (
            <li
              key={keyOf(row)}
              className={cn(
                'grid gap-3 rounded-lg border border-line p-4 transition-opacity md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end',
                !row.active && 'bg-surface-muted',
              )}
            >
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-bold">
                  <ShiftIcon aria-hidden className="size-4" />
                  {tEnums(`shift.${row.shift}`)}
                  <span className="text-muted">·</span>
                  <VehicleIcon aria-hidden className="size-4" />
                  {tEnums(`vehicleType.${row.vehicleType}`)}
                </span>
                <span className="text-xs text-muted">
                  {t('edit.soldHint', { count: row.sold })} ·{' '}
                  {t('edit.freeAfter', { count: freeAfter })}
                </span>
              </div>
              <Input
                label={t('edit.totalSpots')}
                type="number"
                inputMode="numeric"
                min={row.sold}
                value={Number.isNaN(row.totalSpots) ? '' : row.totalSpots}
                onChange={(event) => patch(index, { totalSpots: event.target.valueAsNumber })}
                className="py-2"
              />
              <Input
                label={t('edit.pricePesos')}
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={Number.isNaN(row.price) || row.price === 0 ? '' : row.price}
                onChange={(event) => patch(index, { price: event.target.valueAsNumber })}
                className="py-2"
              />
              <div className="flex items-center gap-2 md:pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(event) => patch(index, { active: event.target.checked })}
                    className="size-4 accent-brand"
                  />
                  {row.active ? t('edit.offerOn') : t('edit.offerOff')}
                </label>
                {row.isNew && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={t('edit.remove')}
                    title={t('edit.remove')}
                    className="text-danger hover:bg-danger/10"
                    onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {free.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2">
          <Select
            label={t('edit.newShift')}
            value={draft?.shift ?? free[0]?.shift}
            onChange={(event) =>
              setDraft({
                shift: event.target.value as Shift,
                vehicleType: draft?.vehicleType ?? 'CAR',
              })
            }
            className="py-2"
          >
            {SHIFTS.map((shift) => (
              <option key={shift} value={shift}>
                {tEnums(`shift.${shift}`)}
              </option>
            ))}
          </Select>
          <Select
            label={t('edit.newVehicle')}
            value={draft?.vehicleType ?? free[0]?.vehicleType}
            onChange={(event) =>
              setDraft({
                shift: draft?.shift ?? 'DAY',
                vehicleType: event.target.value as VehicleType,
              })
            }
            className="py-2"
          >
            {VEHICLE_TYPES.map((vehicle) => (
              <option key={vehicle} value={vehicle}>
                {tEnums(`vehicleType.${vehicle}`)}
              </option>
            ))}
          </Select>
          <Button variant="secondary" disabled={!draftValid} onClick={add}>
            <Plus aria-hidden className="size-4" />
            {t('edit.addOffer')}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">{t('edit.noCombos')}</p>
      )}

      {upsert.error instanceof HttpError && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {upsert.error.message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {saved && !dirty && <span className="text-sm text-success">{t('edit.saved')}</span>}
        {dirty && (
          <Button
            variant="ghost"
            onClick={() => {
              setRows(initial);
              upsert.reset();
            }}
          >
            <Undo2 aria-hidden className="size-4" />
            {t('edit.discard')}
          </Button>
        )}
        <Button
          disabled={!dirty || upsert.isPending || rows.length === 0}
          onClick={() => void save()}
        >
          <Save aria-hidden className="size-4" />
          {upsert.isPending ? t('edit.saving') : t('edit.save')}
        </Button>
      </div>
    </div>
  );
}
