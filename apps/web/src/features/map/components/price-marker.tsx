'use client';

import { cn } from '@parqueavecino/ui';
import { Marker } from 'react-map-gl/maplibre';

export type PriceMarkerProps = {
  latitude: number;
  longitude: number;
  /** Texto del marcador: "$170 mil · 4" o "Lleno". */
  label: string;
  full?: boolean;
  active?: boolean;
  onClick?: () => void;
  onHover?: (hovering: boolean) => void;
};

/** Marcador tipo "píldora" con precio y cupos (mockup 2). Amarillo cuando está seleccionado. */
export function PriceMarker({
  latitude,
  longitude,
  label,
  full = false,
  active = false,
  onClick,
  onHover,
}: PriceMarkerProps) {
  return (
    <Marker
      latitude={latitude}
      longitude={longitude}
      anchor="bottom"
      style={{ zIndex: active ? 10 : 1 }}
    >
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
        className={cn(
          'relative rounded-pill border-2 px-2.5 py-1 text-xs font-bold whitespace-nowrap shadow-md transition-transform',
          'after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-x-[6px] after:border-t-[6px] after:border-x-transparent',
          active
            ? 'scale-110 border-ink bg-brand text-ink after:border-t-ink'
            : full
              ? 'border-line bg-surface text-muted after:border-t-line'
              : 'border-ink bg-ink text-ink-contrast after:border-t-ink',
        )}
      >
        {label}
      </button>
    </Marker>
  );
}

/** Punto de la búsqueda (dirección o ubicación del usuario). */
export function OriginMarker({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <Marker latitude={latitude} longitude={longitude} anchor="center">
      <span className="flex size-5 items-center justify-center rounded-full bg-surface shadow-md">
        <span className="size-3 rounded-full bg-ink ring-4 ring-brand/50" />
      </span>
    </Marker>
  );
}
