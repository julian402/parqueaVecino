'use client';

import { SHIFTS, type Shift } from '@parqueavecino/contracts';
import { Badge, cn } from '@parqueavecino/ui';
import { CircleCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParkingLotsGet200OffersItem } from '@/lib/api/generated/model';
import { useSettingsGetPublic } from '@/lib/api/generated/settings/settings';
import { formatPrice } from '@/lib/format';
import { SHIFT_ICONS } from '@/lib/icons';

export type OfferPickerProps = {
  offers: ParkingLotsGet200OffersItem[];
  selected: Shift | null;
  onSelect: (shift: Shift) => void;
};

/**
 * "Elige tu mensualidad" (mockup 3): una opción por franja con horario, cupos y precio.
 * Las fraccionadas muestran el ahorro frente a la de 24 h del mismo vehículo.
 */
export function OfferPicker({ offers, selected, onSelect }: OfferPickerProps) {
  const t = useTranslations('lot');
  const tEnums = useTranslations('enums');
  const tHome = useTranslations('home.shifts');
  const { data: settings } = useSettingsGetPublic();
  const schedule = settings?.['shift.schedule'];

  const byShift = new Map(offers.map((offer) => [offer.shift, offer]));
  const fullDay = byShift.get('FULL');
  const ordered = SHIFTS.map((shift) => byShift.get(shift)).filter(
    (offer): offer is ParkingLotsGet200OffersItem => offer !== undefined,
  );

  if (ordered.length === 0) {
    return <p className="rounded-md bg-surface-muted p-4 text-sm text-muted">{t('noOffers')}</p>;
  }

  return (
    <div role="radiogroup" aria-label={t('chooseTitle')} className="flex flex-col gap-3">
      {ordered.map((offer) => {
        const Icon = SHIFT_ICONS[offer.shift];
        const hours = offer.shift !== 'FULL' ? schedule?.[offer.shift] : undefined;
        const soldOut = offer.availableSpots === 0;
        const isSelected = selected === offer.shift;
        const savings =
          fullDay && offer.shift !== 'FULL'
            ? fullDay.monthlyPriceMinor - offer.monthlyPriceMinor
            : 0;
        return (
          <button
            key={offer.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={soldOut}
            onClick={() => onSelect(offer.shift)}
            className={cn(
              'flex items-start gap-3 rounded-md border-2 p-4 text-left transition-all',
              isSelected
                ? 'border-ink bg-cream shadow-md'
                : 'border-line bg-surface hover:border-ink',
              soldOut && 'cursor-not-allowed opacity-50 hover:border-line',
            )}
          >
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-pill',
                offer.shift === 'DAY' ? 'bg-brand text-ink' : 'bg-ink text-brand',
              )}
            >
              <Icon aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{tEnums(`shift.${offer.shift}`)}</span>
                {offer.shift === 'FULL' && <Badge>{t('traditional')}</Badge>}
              </span>
              {hours && (
                <span className="text-sm text-muted">
                  {tHome('hours', { start: hours.start, end: hours.end })}
                </span>
              )}
              <span className={cn('text-xs font-bold', soldOut ? 'text-danger' : 'text-success')}>
                {t('spotsFree', { count: offer.availableSpots })}
              </span>
              {savings > 0 && (
                <span className="text-xs font-bold text-brand-text">
                  {t('savings', { amount: formatPrice(savings, offer.currency) })}
                </span>
              )}
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="text-lg font-bold whitespace-nowrap">
                {formatPrice(offer.monthlyPriceMinor, offer.currency)}
              </span>
              <span className="text-xs text-muted">{t('perMonth')}</span>
              {isSelected && <CircleCheck aria-hidden className="size-5 text-ink" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
