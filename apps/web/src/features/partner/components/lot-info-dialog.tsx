'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  AMENITIES,
  parkingLotUpdateSchema,
  type ParkingLot,
  type ParkingLotUpdate,
} from '@parqueavecino/contracts';
import { Button, Dialog, Input } from '@parqueavecino/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  getPartnerParkingLotsListQueryKey,
  usePartnerParkingLotsUpdate,
} from '@/lib/api/generated/partner/partner';
import { HttpError } from '@/lib/api/http';

/** Datos del parqueadero (nombre, dirección, descripción y servicios). */
export function LotInfoDialog({ lot, onClose }: { lot: ParkingLot | null; onClose: () => void }) {
  const t = useTranslations('partner.edit');
  return (
    <Dialog
      open={lot !== null}
      onClose={onClose}
      title={t('infoTitle')}
      description={lot?.name}
      closeLabel={t('cancel')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit" form="lot-info-form">
            {t('saveInfo')}
          </Button>
        </>
      }
    >
      {/* key: el formulario arranca con los datos del parqueadero que se abrió. */}
      {lot && <LotInfoForm key={lot.id} lot={lot} onDone={onClose} />}
    </Dialog>
  );
}

function LotInfoForm({ lot, onDone }: { lot: ParkingLot; onDone: () => void }) {
  const t = useTranslations('partner.edit');
  const tEnums = useTranslations('enums');
  const queryClient = useQueryClient();
  const update = usePartnerParkingLotsUpdate();
  const form = useForm<z.input<typeof parkingLotUpdateSchema>, unknown, ParkingLotUpdate>({
    resolver: zodResolver(parkingLotUpdateSchema),
    defaultValues: {
      name: lot.name,
      address: lot.address,
      neighborhood: lot.neighborhood ?? undefined,
      description: lot.description ?? undefined,
      amenities: lot.amenities,
    },
  });
  const errors = form.formState.errors;

  const submit = form.handleSubmit(async (data) => {
    await update.mutateAsync({ id: lot.id, data });
    void queryClient.invalidateQueries({ queryKey: getPartnerParkingLotsListQueryKey() });
    onDone();
  });

  return (
    <form
      id="lot-info-form"
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <Input label={t('name')} error={errors.name?.message} {...form.register('name')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t('address')} error={errors.address?.message} {...form.register('address')} />
        <Input
          label={t('neighborhood')}
          error={errors.neighborhood?.message}
          {...form.register('neighborhood', {
            setValueAs: (value: string) => (value.trim() === '' ? undefined : value),
          })}
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-bold text-ink">{t('description')}</span>
        <textarea
          rows={3}
          className="rounded-md border-2 border-line bg-surface px-4 py-3 text-ink focus:border-brand focus:ring-4 focus:ring-brand/25 focus:outline-none"
          {...form.register('description', {
            setValueAs: (value: string) => (value.trim() === '' ? undefined : value),
          })}
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-ink">{t('amenities')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {AMENITIES.map((amenity) => (
            <label key={amenity} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={amenity}
                className="size-4 accent-brand"
                {...form.register('amenities')}
              />
              {tEnums(`amenity.${amenity}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {update.error instanceof HttpError && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {update.error.message}
        </p>
      )}
    </form>
  );
}
