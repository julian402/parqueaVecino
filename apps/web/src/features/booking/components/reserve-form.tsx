'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { guestBookingSchema, plateSchema, type GuestBookingInput } from '@parqueavecino/contracts';
import { Button, Input } from '@parqueavecino/ui';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useSession, useSetSessionUser } from '@/features/auth/hooks/use-session';
import { useAuthRegister } from '@/lib/api/generated/auth/auth';
import { useBookingsCreate } from '@/lib/api/generated/bookings/bookings';
import type { ParkingLotsGet200OffersItem } from '@/lib/api/generated/model';
import { useSettingsGetPublic } from '@/lib/api/generated/settings/settings';
import { useVehiclesList } from '@/lib/api/generated/vehicles/vehicles';
import { HttpError } from '@/lib/api/http';
import { routes } from '@/lib/routes';

/** Parámetro de la ficha que conserva la placa al ir a ingresar o registrarse y volver. */
export const PLATE_PARAM = 'placa';

type CreateBooking = ReturnType<typeof useBookingsCreate>;

/** URL de esta ficha (con sus filtros) y la placa elegida, para volver tras ingresar. */
function useReturnUrl(plate: string) {
  const pathname = usePathname();
  const params = new URLSearchParams(useSearchParams().toString());
  if (plate) params.set(PLATE_PARAM, plate);
  else params.delete(PLATE_PARAM);
  return `${pathname}${params.size ? `?${params.toString()}` : ''}`;
}

function SubmitHint({ canReserve }: { canReserve: boolean }) {
  const t = useTranslations('lot');
  const { data: settings } = useSettingsGetPublic();
  return (
    <p className="text-center text-xs text-muted">
      {canReserve
        ? t('reserveHint', { hours: settings?.['booking.freeCancellationHours'] ?? 0 })
        : t('chooseShift')}
    </p>
  );
}

function CreateError({ create }: { create: CreateBooking }) {
  const t = useTranslations('lot');
  if (!create.isError) return null;
  return (
    <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
      {create.error instanceof HttpError ? create.error.message : t('error')}
    </p>
  );
}

function PlateInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const t = useTranslations('lot');
  return (
    <Input
      label={t('plateLabel')}
      placeholder={t('platePlaceholder')}
      value={value}
      onChange={(event) => onChange(event.target.value.toUpperCase())}
      error={error}
      autoComplete="off"
      className="font-bold tracking-widest uppercase"
    />
  );
}

/**
 * Sin sesión: nombre, correo, contraseña y placa en un solo paso. Crea la cuenta de conductor
 * (queda con sesión), aparta el cupo (la placa se guarda en "Mis vehículos") y va al pago.
 */
function GuestReserveForm({
  offer,
  plate,
  onPlate,
  create,
}: {
  offer: ParkingLotsGet200OffersItem | null;
  plate: string;
  onPlate: (plate: string) => void;
  create: CreateBooking;
}) {
  const t = useTranslations('lot');
  const tAuth = useTranslations('auth');
  const router = useRouter();
  const setUser = useSetSessionUser();
  const register = useAuthRegister();
  const form = useForm<z.input<typeof guestBookingSchema>, unknown, GuestBookingInput>({
    resolver: zodResolver(guestBookingSchema),
    defaultValues: { plate },
  });
  const errors = form.formState.errors;
  const loginUrl = `${routes.login}?next=${encodeURIComponent(useReturnUrl(plate))}`;
  const emailTaken = register.error instanceof HttpError && register.error.status === 409;
  const canReserve = offer !== null && offer.availableSpots > 0;

  const onSubmit = form.handleSubmit(async ({ plate: validPlate, ...account }) => {
    if (!offer) return;
    const user = await register.mutateAsync({ data: { ...account, role: 'DRIVER' } });
    // La sesión (cookies) ya existe: la reserva queda en la cuenta nueva desde el inicio.
    try {
      const checkout = await create.mutateAsync({
        data: { offerId: offer.id, plate: validPlate },
      });
      router.push(routes.checkout(checkout.booking.id));
    } finally {
      // Si el cupo se agotó, el formulario pasa al de usuario con sesión y conserva la placa.
      setUser(user);
    }
  });

  const plateField = form.register('plate');

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => void onSubmit(e)} noValidate>
      <div className="flex flex-col gap-1">
        <h3 className="font-bold">{t('guestTitle')}</h3>
        <p className="text-xs text-muted">{t('guestHint')}</p>
      </div>
      <Input
        label={tAuth('fullName')}
        autoComplete="name"
        error={errors.fullName?.message}
        {...form.register('fullName')}
      />
      <Input
        label={tAuth('email')}
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...form.register('email')}
      />
      <Input
        label={tAuth('password')}
        type="password"
        autoComplete="new-password"
        placeholder={tAuth('passwordHint')}
        error={errors.password?.message}
        {...form.register('password')}
      />
      <Input
        label={t('plateLabel')}
        placeholder={t('platePlaceholder')}
        autoComplete="off"
        className="font-bold tracking-widest uppercase"
        error={errors.plate?.message}
        {...plateField}
        onChange={(event) => {
          event.target.value = event.target.value.toUpperCase();
          onPlate(event.target.value);
          void plateField.onChange(event);
        }}
      />
      {emailTaken ? (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {t('emailTaken')}{' '}
          <Link href={loginUrl} className="font-bold underline">
            {t('emailTakenAction')}
          </Link>
        </p>
      ) : (
        register.isError && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {register.error instanceof HttpError ? register.error.message : tAuth('genericError')}
          </p>
        )
      )}
      <CreateError create={create} />
      <Button
        type="submit"
        variant="accent"
        size="lg"
        block
        disabled={!canReserve || register.isPending || create.isPending}
      >
        <Lock aria-hidden className="size-4" />
        {t('guestReserve')}
      </Button>
      <SubmitHint canReserve={canReserve} />
      <p className="text-center text-sm text-muted">
        {t('hasAccount')}{' '}
        <Link href={loginUrl} className="font-bold text-ink underline">
          {t('login')}
        </Link>
      </p>
    </form>
  );
}

/** Con sesión: solo la placa (sugerida desde "Mis vehículos"). */
function MemberReserveForm({
  offer,
  plate,
  onPlate,
  create,
}: {
  offer: ParkingLotsGet200OffersItem | null;
  plate: string | null;
  onPlate: (plate: string) => void;
  create: CreateBooking;
}) {
  const t = useTranslations('lot');
  const router = useRouter();
  const vehicles = useVehiclesList();
  const [plateError, setPlateError] = useState<string | null>(null);

  // Placa sugerida: el primer vehículo registrado del mismo tipo.
  const suggested =
    vehicles.data?.find((vehicle) => vehicle.type === offer?.vehicleType)?.plate ?? '';
  const value = plate ?? suggested;
  const canReserve = offer !== null && offer.availableSpots > 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!offer) return;
    const parsed = plateSchema.safeParse(value);
    if (!parsed.success) {
      setPlateError(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setPlateError(null);
    const checkout = await create.mutateAsync({
      data: { offerId: offer.id, plate: parsed.data },
    });
    router.push(routes.checkout(checkout.booking.id));
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-3" noValidate>
      <PlateInput value={value} onChange={onPlate} error={plateError ?? undefined} />
      <CreateError create={create} />
      <Button
        type="submit"
        variant="accent"
        size="lg"
        block
        disabled={!canReserve || create.isPending}
      >
        <Lock aria-hidden className="size-4" />
        {t('reserve')}
      </Button>
      <SubmitHint canReserve={canReserve} />
    </form>
  );
}

/**
 * "Reservar y pagar 1er mes" (mockup 3 → 4). Con sesión pide la placa; sin sesión crea la
 * cuenta en el mismo paso, sin sacar al visitante de la ficha.
 */
export function ReserveForm({ offer }: { offer: ParkingLotsGet200OffersItem | null }) {
  const { user, isLoading } = useSession();
  const create = useBookingsCreate();
  // La placa sobrevive al ir a ingresar y volver (?placa=) y al pasar de invitado a sesión.
  const [plate, setPlate] = useState<string | null>(useSearchParams().get(PLATE_PARAM));

  if (isLoading) return null;
  return user ? (
    <MemberReserveForm offer={offer} plate={plate} onPlate={setPlate} create={create} />
  ) : (
    <GuestReserveForm offer={offer} plate={plate ?? ''} onPlate={setPlate} create={create} />
  );
}
