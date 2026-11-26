'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@parqueavecino/ui';
import { setWorkerUrl } from 'maplibre-gl';
import { forwardRef, type ReactNode } from 'react';
import MapGL, { NavigationControl, type MapRef } from 'react-map-gl/maplibre';
import { env } from '@/env';

// Worker servido desde public/vendor (lo copia scripts/copy-map-worker.mjs en dev y build).
setWorkerUrl('/vendor/maplibre-gl-worker.mjs');

export type MapViewProps = {
  latitude: number;
  longitude: number;
  zoom: number;
  className?: string;
  /** Sin controles ni arrastre (mapa pequeño de la ficha). */
  interactive?: boolean;
  children?: ReactNode;
};

/**
 * Mapa base (MapLibre + estilo de OpenFreeMap, gratis y sin llave).
 * El estilo viene de NEXT_PUBLIC_MAP_STYLE_URL: cambiar de proveedor no toca código.
 */
export const MapView = forwardRef<MapRef, MapViewProps>(function MapView(
  { latitude, longitude, zoom, className, interactive = true, children },
  ref,
) {
  return (
    <div className={cn('relative overflow-hidden', className)}>
      <MapGL
        ref={ref}
        initialViewState={{ latitude, longitude, zoom }}
        mapStyle={env.NEXT_PUBLIC_MAP_STYLE_URL}
        style={{ width: '100%', height: '100%' }}
        interactive={interactive}
        attributionControl={{ compact: true }}
        cooperativeGestures={false}
      >
        {interactive && <NavigationControl position="top-right" showCompass={false} />}
        {children}
      </MapGL>
    </div>
  );
});
