'use client';

import { SHIFTS, VEHICLE_TYPES, type Shift, type VehicleType } from '@parqueavecino/contracts';
import { Button, Card, Input, Pill } from '@parqueavecino/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/** Pantalla 1 del mockup: dónde, franja y vehículo. La búsqueda real llega en la Fase 2. */
export function SearchHero() {
  const t = useTranslations('home');
  const tEnums = useTranslations('enums');
  const [shift, setShift] = useState<Shift>('NIGHT');
  const [vehicle, setVehicle] = useState<VehicleType>('CAR');

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 md:py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold md:text-4xl">{t('title')}</h1>
        <p className="text-muted">{t('subtitle')}</p>
      </div>
      <Card className="flex flex-col gap-4 p-4">
        <Input label={t('whereLabel')} placeholder={t('wherePlaceholder')} />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs text-muted">{t('shiftLabel')}</legend>
          <div className="flex flex-wrap">
            {SHIFTS.map((value) => (
              <Pill key={value} active={shift === value} onClick={() => setShift(value)}>
                {tEnums(`shift.${value}`)}
              </Pill>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs text-muted">{t('vehicleLabel')}</legend>
          <div className="flex flex-wrap">
            {VEHICLE_TYPES.map((value) => (
              <Pill key={value} active={vehicle === value} onClick={() => setVehicle(value)}>
                {tEnums(`vehicleType.${value}`)}
              </Pill>
            ))}
          </div>
        </fieldset>
        <Button variant="accent" size="lg" block>
          {t('submit')}
        </Button>
      </Card>
    </section>
  );
}
