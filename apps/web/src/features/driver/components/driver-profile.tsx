'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  VEHICLE_TYPES,
  vehicleInputSchema,
  type Vehicle,
  type VehicleInput,
} from '@parqueavecino/contracts';
import { Badge, Button, Dialog, Input, Select, Skeleton } from '@parqueavecino/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useSession } from '@/features/auth/hooks/use-session';
import { PageHeader, Panel } from '@/features/panel/components/panel-ui';
import {
  getVehiclesListQueryKey,
  useVehiclesCreate,
  useVehiclesList,
  useVehiclesRemove,
} from '@/lib/api/generated/vehicles/vehicles';
import { HttpError } from '@/lib/api/http';
import { maskPlate, plateFieldProps, withMask } from '@/lib/form-fields';
import { VEHICLE_ICONS } from '@/lib/icons';

/** Datos de la cuenta y vehículos (placas) del conductor. */
export function DriverProfile() {
  const t = useTranslations('panel.driver.profile');
  const tRoles = useTranslations('panel.roles');
  const { user } = useSession();

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title={t('account')}>
          {user ? (
            <dl className="grid gap-4 text-sm">
              {(
                [
                  ['name', user.fullName],
                  ['email', user.email],
                  ['role', tRoles(user.role)],
                ] as const
              ).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className="text-muted">{t(key)}</dt>
                  <dd className="font-bold break-words">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Skeleton className="h-32" />
          )}
        </Panel>
        <VehiclesPanel />
      </div>
    </>
  );
}

function VehiclesPanel() {
  const t = useTranslations('panel.driver.profile');
  const tEnums = useTranslations('enums');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const list = useVehiclesList();
  const create = useVehiclesCreate();
  const remove = useVehiclesRemove();
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const form = useForm<z.input<typeof vehicleInputSchema>, unknown, VehicleInput>({
    resolver: zodResolver(vehicleInputSchema),
    defaultValues: { type: 'CAR' },
  });
  const tFields = useTranslations('fields');
  const vehicleType = form.watch('type');
  const plateField = form.register('plate');
  const refresh = () => queryClient.invalidateQueries({ queryKey: getVehiclesListQueryKey() });

  const submit = form.handleSubmit(async (data) => {
    await create.mutateAsync({ data });
    form.reset({ type: data.type, plate: '', nickname: '' });
    void refresh();
  });

  const confirmRemove = async () => {
    if (!removing) return;
    await remove.mutateAsync({ id: removing.id });
    setRemoving(null);
    void refresh();
  };

  const vehicles = list.data ?? [];

  return (
    <Panel title={t('vehiclesTitle')}>
      {list.isLoading ? (
        <Skeleton className="h-24" />
      ) : vehicles.length === 0 ? (
        <p className="text-sm text-muted">{t('vehiclesEmpty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {vehicles.map((vehicle) => {
            const Icon = VEHICLE_ICONS[vehicle.type];
            return (
              <li key={vehicle.id} className="flex items-center gap-3 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-fill">
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-mono font-bold tracking-wider">{vehicle.plate}</span>
                  <span className="truncate text-xs text-muted">
                    {vehicle.nickname ?? tEnums(`vehicleType.${vehicle.type}`)}
                  </span>
                </div>
                <Badge>{tEnums(`vehicleType.${vehicle.type}`)}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('remove')}
                  title={t('remove')}
                  className="text-danger hover:bg-danger/10"
                  onClick={() => setRemoving(vehicle)}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="grid gap-3 border-t border-line pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] sm:items-end"
      >
        <Input
          label={tFields(`plate.${vehicleType}.label`)}
          {...plateFieldProps(vehicleType)}
          error={form.formState.errors.plate?.message}
          className="py-2 font-bold tracking-widest uppercase"
          {...plateField}
          onChange={withMask((value) => maskPlate(value, vehicleType), plateField.onChange)}
        />
        <Select label={t('type')} className="py-2" {...form.register('type')}>
          {VEHICLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {tEnums(`vehicleType.${type}`)}
            </option>
          ))}
        </Select>
        <Input
          label={t('nickname')}
          className="py-2"
          {...form.register('nickname', {
            setValueAs: (value: string) => (value.trim() === '' ? undefined : value),
          })}
        />
        <Button type="submit" disabled={create.isPending}>
          <Plus aria-hidden className="size-4" />
          {t('add')}
        </Button>
      </form>
      {create.error instanceof HttpError && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {create.error.message}
        </p>
      )}

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={t('removeConfirm', { plate: removing?.plate ?? '' })}
        closeLabel={tCommon('close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              {tCommon('cancel')}
            </Button>
            <Button
              className="border-danger bg-danger hover:bg-danger/90"
              disabled={remove.isPending}
              onClick={() => void confirmRemove()}
            >
              <Trash2 aria-hidden className="size-4" />
              {t('remove')}
            </Button>
          </>
        }
      >
        {remove.error instanceof HttpError && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {remove.error.message}
          </p>
        )}
      </Dialog>
    </Panel>
  );
}
