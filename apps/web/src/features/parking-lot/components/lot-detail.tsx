'use client';

import { VEHICLE_TYPES, type Shift } from '@parqueavecino/contracts';
import { Badge, Card, ParkingThumbnail, Pill } from '@parqueavecino/ui';
import { distanceBetween } from '@parqueavecino/utils';
import { ArrowLeft, BadgeCheck, MapPin, Navigation, SearchX } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { HttpError } from '@/lib/api/http';
import { useParkingLotsGet } from '@/lib/api/generated/parking-lots/parking-lots';
import { formatMeters, formatShortPrice } from '@/lib/format';
import { AMENITY_ICONS, VEHICLE_ICONS } from '@/lib/icons';
import { routes } from '@/lib/routes';
import { ReserveForm } from '../../booking/components/reserve-form';
import { parseSearchState, searchUrl } from '../../search/lib/search-state';
import { OfferPicker } from './offer-picker';

const LotMap = dynamic(() => import('./lot-map'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-fill" />,
});

/** URL de "Cómo llegar" en OpenStreetMap (gratis, sin llave). */
const directionsUrl = (lat: number, lng: number) =>
  `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}#map=17/${lat}/${lng}`;

/** Ficha del parqueadero (mockup 3): datos, servicios, mensualidades por franja y mapa. */
export function LotDetail({ id }: { id: string }) {
  const t = useTranslations('lot');
  const tEnums = useTranslations('enums');
  const router = useRouter();
  const params = useSearchParams();
  const search = useMemo(() => parseSearchState(new URLSearchParams(params)), [params]);
  const [shift, setShift] = useState<Shift | null>(search.shift);

  const {
    data: lot,
    error,
    isPending,
  } = useParkingLotsGet(id, {
    query: { retry: false },
  });

  if (isPending) {
    return (
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[1fr_24rem]">
        <div className="h-72 animate-pulse rounded-md bg-fill" />
        <div className="h-96 animate-pulse rounded-md bg-fill" />
      </div>
    );
  }

  if (error || !lot) {
    const notFound = error instanceof HttpError && error.status === 404;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <SearchX aria-hidden className="size-10 text-muted" />
        <p className="font-bold">{notFound ? t('notFound') : t('error')}</p>
        <Link href={routes.search} className="font-bold underline">
          {t('back')}
        </Link>
      </div>
    );
  }

  const origin =
    search.lat !== undefined && search.lng !== undefined
      ? { latitude: search.lat, longitude: search.lng }
      : null;
  const distance = origin ? distanceBetween(origin, lot) : null;
  const offers = lot.offers.filter((offer) => offer.active && offer.vehicleType === search.vehicle);
  const selectedOffer = offers.find((offer) => offer.shift === shift) ?? null;
  const cheapest = offers.reduce<number | null>(
    (min, offer) =>
      min === null ? offer.monthlyPriceMinor : Math.min(min, offer.monthlyPriceMinor),
    null,
  );

  const changeVehicle = (vehicle: (typeof VEHICLE_TYPES)[number]) => {
    const next = new URLSearchParams(params);
    next.set('vehicle', vehicle);
    router.replace(`${routes.parkingLot(id)}?${next.toString()}`, { scroll: false });
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
      <Link
        href={searchUrl(search)}
        className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {t('back')}
      </Link>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_24rem] lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex flex-col gap-6">
          <ParkingThumbnail
            caption={lot.neighborhood}
            src={lot.photos[0]}
            alt={lot.name}
            className="h-56 w-full md:h-72"
          />

          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold md:text-3xl">{lot.name}</h1>
              {lot.verified && (
                <Badge tone="success">
                  <BadgeCheck aria-hidden className="size-3.5" />
                  {t('verifiedTitle')}
                </Badge>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-muted">
              <MapPin aria-hidden className="size-4 shrink-0" />
              {lot.address}
              {lot.neighborhood && ` · ${lot.neighborhood}`}
            </p>
            {distance !== null && (
              <p className="text-sm font-bold text-brand-text">
                {t('distance', { distance: formatMeters(distance) })}
              </p>
            )}
          </header>

          {lot.verified && (
            <Card className="flex items-start gap-3 border-success/30 bg-success/5">
              <BadgeCheck aria-hidden className="size-6 shrink-0 text-success" />
              <div>
                <p className="font-bold">{t('verifiedTitle')}</p>
                <p className="text-sm text-muted">{t('verifiedDetail')}</p>
              </div>
            </Card>
          )}

          {lot.amenities.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-bold">{t('services')}</h2>
              <ul className="flex flex-wrap gap-2">
                {lot.amenities.map((amenity) => {
                  const Icon = AMENITY_ICONS[amenity];
                  return (
                    <li
                      key={amenity}
                      className="flex items-center gap-2 rounded-pill bg-fill px-3 py-1.5 text-sm font-bold"
                    >
                      <Icon aria-hidden className="size-4" />
                      {tEnums(`amenity.${amenity}`)}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {lot.description && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">{t('about')}</h2>
              <p className="text-muted">{lot.description}</p>
            </section>
          )}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold">{t('location')}</h2>
              <a
                href={directionsUrl(lot.latitude, lot.longitude)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-bold text-ink underline"
              >
                <Navigation aria-hidden className="size-4" />
                {t('openInMaps')}
              </a>
            </div>
            <LotMap
              lot={lot}
              origin={origin}
              label={cheapest !== null ? formatShortPrice(cheapest) : lot.name}
              className="h-56 rounded-md md:h-72"
            />
          </section>
        </div>

        <aside className="md:sticky md:top-20 md:self-start">
          <Card className="flex flex-col gap-4 p-5 shadow-xl shadow-ink/10">
            <h2 className="text-xl font-bold">{t('chooseTitle')}</h2>
            <div role="group" aria-label={t('vehicleLabel')} className="flex flex-wrap gap-2">
              {VEHICLE_TYPES.map((vehicle) => {
                const Icon = VEHICLE_ICONS[vehicle];
                return (
                  <Pill
                    key={vehicle}
                    active={search.vehicle === vehicle}
                    onClick={() => changeVehicle(vehicle)}
                    className="px-3 py-1.5"
                  >
                    <Icon aria-hidden className="size-4" />
                    {tEnums(`vehicleType.${vehicle}`)}
                  </Pill>
                );
              })}
            </div>
            <OfferPicker
              offers={offers}
              selected={selectedOffer?.shift ?? null}
              onSelect={setShift}
            />
            <ReserveForm offer={selectedOffer} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
