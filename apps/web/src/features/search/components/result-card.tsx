'use client';

import { Badge, ParkingThumbnail, cn } from '@parqueavecino/ui';
import { BadgeCheck, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ParkingLotsSearch200ResultsItem } from '@/lib/api/generated/model';
import { formatMeters, formatPrice } from '@/lib/format';
import { AMENITY_ICONS } from '@/lib/icons';

export type ResultCardProps = {
  result: ParkingLotsSearch200ResultsItem;
  href: string;
  active?: boolean;
  onHover?: (hovering: boolean) => void;
};

/** Tarjeta de resultado: foto, nombre, distancia, cupos libres y precio/mes (mockup 2). */
export function ResultCard({ result, href, active = false, onHover }: ResultCardProps) {
  const t = useTranslations('search');
  const tEnums = useTranslations('enums');
  const { offer } = result;
  const full = offer.availableSpots === 0;

  return (
    <Link
      href={href}
      id={`lot-${result.id}`}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
      className={cn(
        'flex gap-3 rounded-md border-2 bg-surface p-3 transition-all hover:shadow-md',
        active ? 'border-brand shadow-md' : 'border-transparent shadow-sm',
        full && 'opacity-70',
      )}
    >
      <ParkingThumbnail
        caption={result.neighborhood}
        src={result.photo}
        alt={result.name}
        className="size-24 md:size-28"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-bold">{result.name}</h3>
          {result.verified && (
            <Badge tone="success" className="shrink-0">
              <BadgeCheck aria-hidden className="size-3.5" />
              <span className="hidden sm:inline">{t('verified')}</span>
            </Badge>
          )}
        </div>
        <p className="flex items-center gap-1 truncate text-sm text-muted">
          <MapPin aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{result.address}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0">{formatMeters(result.distanceMeters)}</span>
        </p>
        <div className="flex flex-wrap gap-1.5 text-muted">
          {result.amenities.slice(0, 4).map((amenity) => {
            const Icon = AMENITY_ICONS[amenity];
            return (
              <span
                key={amenity}
                title={tEnums(`amenity.${amenity}`)}
                className="flex items-center rounded-sm bg-fill p-1"
              >
                <Icon aria-label={tEnums(`amenity.${amenity}`)} className="size-3.5" />
              </span>
            );
          })}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2">
          <Badge tone={full ? 'danger' : 'brand'}>
            {full ? t('full') : t('free', { count: offer.availableSpots })}
          </Badge>
          <p className="text-right">
            <span className="text-lg font-bold">
              {formatPrice(offer.monthlyPriceMinor, offer.currency)}
            </span>
            <span className="text-xs text-muted">{t('perMonth')}</span>
          </p>
        </div>
      </div>
    </Link>
  );
}
