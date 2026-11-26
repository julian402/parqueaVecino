'use client';

import { SEARCH_SORTS, SHIFTS, VEHICLE_TYPES } from '@parqueavecino/contracts';
import { Pill, cn } from '@parqueavecino/ui';
import { Umbrella } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSettingsGetPublic } from '@/lib/api/generated/settings/settings';
import { formatShortPrice } from '@/lib/format';
import { SHIFT_ICONS, VEHICLE_ICONS } from '@/lib/icons';
import type { SearchState } from '../lib/search-state';

export type SearchFiltersProps = {
  state: SearchState;
  onChange: (patch: Partial<SearchState>) => void;
};

/** Chips de franja, vehículo, precio máximo y techo + orden (mockup 2). */
export function SearchFilters({ state, onChange }: SearchFiltersProps) {
  const t = useTranslations('search');
  const tEnums = useTranslations('enums');
  const { data: settings } = useSettingsGetPublic();
  // Topes de precio por vehículo desde system_settings (search.priceFiltersMinor).
  const priceSteps = settings?.['search.priceFiltersMinor']?.[state.vehicle] ?? [];

  return (
    <div className="flex flex-col gap-3">
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
        <Divider />
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
      </ChipRow>

      <ChipRow>
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
        <Divider />
        <Pill
          active={state.roof}
          tone="brand"
          onClick={() => onChange({ roof: !state.roof })}
          className="shrink-0 px-3 py-1.5"
        >
          <Umbrella aria-hidden className="size-4" />
          {t('withRoof')}
        </Pill>
      </ChipRow>

      <div className="flex items-center gap-2 text-sm">
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
                state.sort === sort ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
              )}
            >
              {t(`sort.${sort}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Fila de chips con scroll horizontal en celular. */
function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0">
      {children}
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-line" />;
}
