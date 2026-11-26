'use client';

import { SHIFTS, VEHICLE_TYPES, type Shift, type VehicleType } from '@parqueavecino/contracts';
import { Button, Card, Pill } from '@parqueavecino/ui';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { SHIFT_ICONS, VEHICLE_ICONS } from '@/lib/icons';
import { PlaceSearch, type Place } from '../../search/components/place-search';
import { searchUrl } from '../../search/lib/search-state';

/** Tarjeta de búsqueda (mockup 1): dónde, franja y vehículo → /buscar. */
export function SearchCard() {
  const t = useTranslations('home');
  const tEnums = useTranslations('enums');
  const router = useRouter();
  const [shift, setShift] = useState<Shift>('NIGHT');
  const [vehicle, setVehicle] = useState<VehicleType>('CAR');
  const [place, setPlace] = useState<Place | null>(null);

  // Sin lugar elegido se busca alrededor del centro por defecto (system_settings).
  const submit = (event: FormEvent) => {
    event.preventDefault();
    router.push(
      searchUrl({
        q: place?.label,
        lat: place?.latitude,
        lng: place?.longitude,
        shift,
        vehicle,
      }),
    );
  };

  return (
    <Card className="p-5 shadow-xl shadow-ink/10 md:p-7">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <h2 className="text-lg font-bold">{t('searchTitle')}</h2>
        <PlaceSearch label={t('whereLabel')} onSelect={setPlace} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold">{t('shiftLabel')}</legend>
          <div className="flex flex-wrap gap-2">
            {SHIFTS.map((value) => {
              const Icon = SHIFT_ICONS[value];
              return (
                <Pill
                  key={value}
                  active={shift === value}
                  tone={value === 'DAY' ? 'brand' : 'ink'}
                  onClick={() => setShift(value)}
                >
                  <Icon aria-hidden className="size-4" />
                  {tEnums(`shift.${value}`)}
                </Pill>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold">{t('vehicleLabel')}</legend>
          <div className="flex flex-wrap gap-2">
            {VEHICLE_TYPES.map((value) => {
              const Icon = VEHICLE_ICONS[value];
              return (
                <Pill key={value} active={vehicle === value} onClick={() => setVehicle(value)}>
                  <Icon aria-hidden className="size-4" />
                  {tEnums(`vehicleType.${value}`)}
                </Pill>
              );
            })}
          </div>
        </fieldset>
        <Button type="submit" variant="accent" size="lg" block>
          <Search aria-hidden className="size-5" />
          {t('submit')}
        </Button>
        <p className="text-center text-xs text-muted">{t('searchSoon')}</p>
      </form>
    </Card>
  );
}
