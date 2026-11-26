'use client';

import { Badge, Card, CardTitle } from '@parqueavecino/ui';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePartnerParkingLotsList } from '@/lib/api/generated/partner/partner';
import { HttpError } from '@/lib/api/http';
import { formatPrice } from '@/lib/format';
import { routes } from '@/lib/routes';

/** Pantalla 7 (parcial): parqueaderos del aliado con sus cupos por franja. */
export function PartnerLots() {
  const t = useTranslations('partner');
  const tEnums = useTranslations('enums');
  const tNav = useTranslations('nav');
  const query = usePartnerParkingLotsList();
  const lots = query.data ?? [];

  if (query.error instanceof HttpError && [401, 403].includes(query.error.status)) {
    return (
      <p className="px-4 py-10 text-center text-muted">
        {t('onlyPartners')}{' '}
        <Link href={routes.login} className="font-bold text-ink underline">
          {tNav('signIn')}
        </Link>
      </p>
    );
  }

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:px-7">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {!query.isLoading && lots.length === 0 && <p className="text-muted">{t('empty')}</p>}
      {lots.map((lot) => (
        <Card key={lot.id} className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{lot.name}</CardTitle>
              <p className="text-sm text-muted">
                {[lot.address, lot.neighborhood, lot.city].filter(Boolean).join(' · ')}
              </p>
            </div>
            <div className="flex gap-2">
              {lot.verified && <Badge tone="success">✓ {t('verified')}</Badge>}
              <Badge>{t(`status.${lot.status}`)}</Badge>
            </div>
          </div>

          <h2 className="text-sm font-bold">{t('offersTitle')}</h2>
          {lot.offers.length === 0 ? (
            <p className="text-sm text-muted">{t('noOffers')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    {(['shift', 'vehicle', 'total', 'available', 'price'] as const).map((col) => (
                      <th key={col} className="border-b-2 border-line px-2 py-2 font-normal">
                        {t(`columns.${col}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lot.offers.map((offer) => (
                    <tr key={offer.id}>
                      <td className="border-b border-line px-2 py-2">
                        {tEnums(`shift.${offer.shift}`)}
                      </td>
                      <td className="border-b border-line px-2 py-2">
                        {tEnums(`vehicleType.${offer.vehicleType}`)}
                      </td>
                      <td className="border-b border-line px-2 py-2">{offer.totalSpots}</td>
                      <td className="border-b border-line px-2 py-2">{offer.availableSpots}</td>
                      <td className="border-b border-line px-2 py-2">
                        {formatPrice(offer.monthlyPriceMinor, offer.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}
    </section>
  );
}
