'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';
import type { ParkingLotsSearch200ResultsItem } from '@/lib/api/generated/model';
import { formatShortPrice } from '@/lib/format';
import { MapView } from '../../map/components/map-view';
import { OriginMarker, PriceMarker } from '../../map/components/price-marker';

/** Zoom inicial alrededor del punto buscado (barrio). */
const INITIAL_ZOOM = 14;
const FIT_PADDING = 60;
const MAX_FIT_ZOOM = 16;

export type ResultsMapProps = {
  origin: { latitude: number; longitude: number };
  results: ParkingLotsSearch200ResultsItem[];
  activeId: string | null;
  onActivate: (id: string | null) => void;
  onSelect: (id: string) => void;
  className?: string;
};

/** Mapa de resultados con marcadores de precio; se ajusta para mostrar todos los parqueaderos. */
export default function ResultsMap({
  origin,
  results,
  activeId,
  onActivate,
  onSelect,
  className,
}: ResultsMapProps) {
  const t = useTranslations('search');
  const mapRef = useRef<MapRef>(null);

  // Al cambiar el origen o los resultados, encuadra el punto buscado y todos los parqueaderos.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const points = [origin, ...results];
    const lngs = points.map((p) => p.longitude);
    const lats = points.map((p) => p.latitude);
    if (points.length === 1) {
      map.flyTo({ center: [origin.longitude, origin.latitude], zoom: INITIAL_ZOOM });
      return;
    }
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: FIT_PADDING, maxZoom: MAX_FIT_ZOOM, duration: 600 },
    );
  }, [origin, results]);

  return (
    <MapView
      ref={mapRef}
      latitude={origin.latitude}
      longitude={origin.longitude}
      zoom={INITIAL_ZOOM}
      className={className}
    >
      <OriginMarker latitude={origin.latitude} longitude={origin.longitude} />
      {results.map((result) => {
        const full = result.offer.availableSpots === 0;
        const price = formatShortPrice(result.offer.monthlyPriceMinor, result.offer.currency);
        return (
          <PriceMarker
            key={result.id}
            latitude={result.latitude}
            longitude={result.longitude}
            label={full ? t('full') : `${price} · ${result.offer.availableSpots}`}
            full={full}
            active={activeId === result.id}
            onHover={(hovering) => onActivate(hovering ? result.id : null)}
            onClick={() => onSelect(result.id)}
          />
        );
      })}
    </MapView>
  );
}
