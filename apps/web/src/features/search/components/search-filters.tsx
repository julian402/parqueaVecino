'use client';

import { SEARCH_SORTS, SHIFTS, VEHICLE_TYPES } from '@parqueavecino/contracts';
import { Pill, cn } from '@parqueavecino/ui';
import { SlidersHorizontal, Umbrella } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useSettingsGetPublic } from '@/lib/api/generated/settings/settings';
import { formatShortPrice } from '@/lib/format';
import { SHIFT_ICONS, VEHICLE_ICONS } from '@/lib/icons';
import type { SearchState } from '../lib/search-state';

export type SearchFiltersProps = {
  state: SearchState;
  onChange: (patch: Partial<SearchState>) => void;
};

/** Franja siempre visible; vehículo, precio, techo y orden en un panel plegable. */
export function SearchFilters({ state, onChange }: SearchFiltersProps) {
  const t = useTranslations('search');
  const tEnums = useTranslations('enums');
  const { data: settings } = useSettingsGetPublic();
  // Topes de precio por vehículo desde system_settings (search.priceFiltersMinor).
  const priceSteps = settings?.['search.priceFiltersMinor']?.[state.vehicle] ?? [];

  const [open, setOpen] = useState(false);
  // Filtros secundarios activos (el vehículo por defecto es carro).
  const activeCount =
    Number(state.vehicle !== 'CAR') + Number(state.maxPrice !== undefined) + Number(state.roof);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ChipRow>
          {SHIFTS.map((shift) => {
            const Icon = SHIFT_ICONS[shift];
            return (
              <Pill
                key={shift}
                active={state.shift === shift}
                tone={shift === 'DAY' ? 'brand' : 'ink'}
                onClick={() => onChange({ shift })}
                className="shrink-0 px-3 py-1.5"
              >
                <Icon aria-hidden className="size-4" />
                {tEnums(`shift.${shift}`)}
              </Pill>
            );
          })}
        </ChipRow>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="search-more-filters"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            'ml-auto inline-flex shrink-0 items-center gap-2 rounded-pill border px-3 py-1.5 text-sm font-bold transition-colors',
            open || activeCount > 0
              ? 'border-ink bg-ink text-ink-contrast'
              : 'border-line bg-surface hover:border-ink',
          )}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          {t('filters')}
          {activeCount > 0 && (
            <span className="rounded-pill bg-brand px-1.5 text-xs text-ink">{activeCount}</span>
          )}
        </button>
      </div>

      {open && (
        <div
          id="search-more-filters"
          className="flex flex-col gap-4 rounded-lg border border-line bg-surface-muted p-4"
        >
          <FilterGroup label={t('vehicleLabel')}>
            {VEHICLE_TYPES.map((vehicle) => {
              const Icon = VEHICLE_ICONS[vehicle];
              return (
                <Pill
                  key={vehicle}
                  active={state.vehicle === vehicle}
                  // El precio máximo depende del vehículo: se limpia al cambiarlo.
                  onClick={() => onChange({ vehicle, maxPrice: undefined })}
                  className="shrink-0 px-3 py-1.5"
                >
                  <Icon aria-hidden className="size-4" />
                  {tEnums(`vehicleType.${vehicle}`)}
                </Pill>
              );
            })}
          </FilterGroup>

          <FilterGroup label={t('priceLabel')}>
            <Pill
              active={state.maxPrice === undefined}
              tone="brand"
              onClick={() => onChange({ maxPrice: undefined })}
              className="shrink-0 px-3 py-1.5"
            >
              {t('anyPrice')}
            </Pill>
            {priceSteps.map((price) => (
              <Pill
                key={price}
                active={state.maxPrice === price}
                tone="brand"
                onClick={() => onChange({ maxPrice: price })}
                className="shrink-0 px-3 py-1.5"
              >
                {t('priceUpTo', { price: formatShortPrice(price) })}
              </Pill>
            ))}
            <Pill
              active={state.roof}
              tone="brand"
              onClick={() => onChange({ roof: !state.roof })}
              className="shrink-0 px-3 py-1.5"
            >
              <Umbrella aria-hidden className="size-4" />
              {t('withRoof')}
            </Pill>
          </FilterGroup>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted">{t('sortLabel')}</span>
              <div className="inline-flex rounded-pill bg-fill p-1">
                {SEARCH_SORTS.map((sort) => (
                  <button
                    key={sort}
                    type="button"
                    aria-pressed={state.sort === sort}
                    onClick={() => onChange({ sort })}
                    className={cn(
                      'rounded-pill px-3 py-1 font-bold transition-colors',
                      state.sort === sort
                        ? 'bg-surface text-ink shadow-sm'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {t(`sort.${sort}`)}
                  </button>
                ))}
              </div>
            </div>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={() => onChange({ vehicle: 'CAR', maxPrice: undefined, roof: false })}
                className="font-bold text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                {t('clearFilters')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold tracking-wide text-muted uppercase">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** Fila de chips con scroll horizontal en celular. */
function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">{children}</div>
  );
}
