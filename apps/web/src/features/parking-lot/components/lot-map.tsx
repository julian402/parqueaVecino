'use client';

import { MapView } from '../../map/components/map-view';
import { OriginMarker, PriceMarker } from '../../map/components/price-marker';

type Point = { latitude: number; longitude: number };

const LOT_ZOOM = 15;

/** Mapa pequeño de la ficha: el parqueadero y, si se conoce, el punto buscado. */
export default function LotMap({
  lot,
  label,
  origin,
  className,
}: {
  lot: Point;
  label: string;
  origin?: Point | null;
  className?: string;
}) {
  return (
    <MapView
      latitude={lot.latitude}
      longitude={lot.longitude}
      zoom={LOT_ZOOM}
      interactive={false}
      className={className}
    >
      {origin && <OriginMarker latitude={origin.latitude} longitude={origin.longitude} />}
      <PriceMarker latitude={lot.latitude} longitude={lot.longitude} label={label} active />
    </MapView>
  );
}
