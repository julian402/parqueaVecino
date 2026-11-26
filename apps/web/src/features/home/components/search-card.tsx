'use client';

import { SHIFTS, VEHICLE_TYPES, type Shift, type VehicleType } from '@parqueavecino/contracts';
import { Button, Card, Input, Pill } from '@parqueavecino/ui';
import { Bike, Car, Clock, Moon, Search, Sun, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const SHIFT_ICONS: Record<Shift, LucideIcon> = { DAY: Sun, NIGHT: Moon, FULL: Clock };
const VEHICLE_ICONS: Record<VehicleType, LucideIcon> = {
  CAR: Car,
  MOTORCYCLE: Bike,
  BICYCLE: Bike,
};

/** Tarjeta de búsqueda (mockup 1): dónde, franja y vehículo. La búsqueda real llega en la Fase 2. */
export function SearchCard() {
  const t = useTranslations('home');
  const tEnums = useTranslations('enums');
  const [shift, setShift] = useState<Shift>('NIGHT');
  const [vehicle, setVehicle] = useState<VehicleType>('CAR');

  return (
    <Card className="flex flex-col gap-5 p-5 shadow-xl shadow-ink/10 md:p-7">
      <h2 className="text-lg font-bold">{t('searchTitle')}</h2>
      <Input label={t('whereLabel')} placeholder={t('wherePlaceholder')} />
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
      <Button variant="accent" size="lg" block>
        <Search aria-hidden className="size-5" />
        {t('submit')}
      </Button>
      <p className="text-center text-xs text-muted">{t('searchSoon')}</p>
    </Card>
  );
}
