'use client';

import { plateSchema } from '@parqueavecino/contracts';
import { Button, buttonVariants, Input } from '@parqueavecino/ui';
import { Lock, LogIn } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useSession } from '@/features/auth/hooks/use-session';
import { useBookingsCreate } from '@/lib/api/generated/bookings/bookings';
import type { ParkingLotsGet200OffersItem } from '@/lib/api/generated/model';
import { useSettingsGetPublic } from '@/lib/api/generated/settings/settings';
import { useVehiclesList } from '@/lib/api/generated/vehicles/vehicles';
import { HttpError } from '@/lib/api/http';
import { routes } from '@/lib/routes';

/**
 * "Reservar y pagar 1er mes" (mockup 3 → 4): placa del vehículo y creación de la reserva.
 * Sin sesión lleva a ingresar y vuelve a esta ficha.
 */
export function ReserveForm({ offer }: { offer: ParkingLotsGet200OffersItem | null }) {
  const t = useTranslations('lot');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { user, isLoading } = useSession();
  const { data: settings } = useSettingsGetPublic();
  const vehicles = useVehiclesList({ query: { enabled: Boolean(user) } });
  const create = useBookingsCreate();
  const [plate, setPlate] = useState<string | null>(null);
  const [plateError, setPlateError] = useState<string | null>(null);

  // Placa sugerida: el primer vehículo registrado del mismo tipo.
  const suggested =
    vehicles.data?.find((vehicle) => vehicle.type === offer?.vehicleType)?.plate ?? '';
  const value = plate ?? suggested;
  const canReserve = offer !== null && offer.availableSpots > 0;

  if (!isLoading && !user) {
    const here = `${pathname}${params.size ? `?${params.toString()}` : ''}`;
    return (
      <Link
        href={`${routes.login}?next=${encodeURIComponent(here)}`}
        className={buttonVariants({ variant: 'accent', size: 'lg', block: true })}
      >
        <LogIn aria-hidden className="size-5" />
        {t('loginToReserve')}
      </Link>
    );
  }

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
      <Input
        label={t('plateLabel')}
        placeholder={t('platePlaceholder')}
        value={value}
        onChange={(event) => setPlate(event.target.value.toUpperCase())}
        error={plateError ?? undefined}
        autoComplete="off"
        className="font-bold tracking-widest uppercase"
      />
      {create.isError && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {create.error instanceof HttpError ? create.error.message : t('error')}
        </p>
      )}
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
      <p className="text-center text-xs text-muted">
        {canReserve
          ? t('reserveHint', { hours: settings?.['booking.freeCancellationHours'] ?? 0 })
          : t('chooseShift')}
      </p>
    </form>
  );
}
