'use client';

import { cn } from '@parqueavecino/ui';
import { LoaderCircle, LocateFixed, MapPin, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { useGeocodingSearch } from '@/lib/api/generated/geocoding/geocoding';
import { useDebouncedValue } from '@/lib/use-debounced-value';

export type Place = { label: string; latitude: number; longitude: number };

/** Mínimo de letras antes de consultar el geocodificador (igual que `geocodeQuerySchema`). */
const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;

export type PlaceSearchProps = {
  defaultValue?: string;
  onSelect: (place: Place) => void;
  /** Etiqueta visible (en el inicio) o solo accesible (en /buscar). */
  label?: string;
  className?: string;
};

/** Campo "¿dónde?" con sugerencias (Nominatim vía la API) y botón de ubicación actual. */
export function PlaceSearch({ defaultValue = '', onSelect, label, className }: PlaceSearchProps) {
  const t = useTranslations('search');
  const inputId = useId();
  const listId = useId();
  const [text, setText] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState(false);

  const query = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const enabled = open && query.length >= MIN_QUERY_LENGTH && query !== defaultValue;
  const { data: places = [], isFetching } = useGeocodingSearch(
    { q: query },
    { query: { enabled, staleTime: Infinity } },
  );

  const choose = (place: Place) => {
    setText(place.label);
    setOpen(false);
    onSelect(place);
  };

  const useMyLocation = () => {
    setLocationError(false);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        choose({
          label: t('myLocationLabel'),
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setLocationError(true);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const showList = open && enabled && !isFetching;

  return (
    <div className={cn('relative flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className={label ? 'text-sm font-bold text-ink' : 'sr-only'}>
        {label ?? t('placeholder')}
      </label>
      <div className="flex items-center gap-2 rounded-md border-2 border-line bg-surface px-3 transition-colors focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/25">
        {isFetching ? (
          <LoaderCircle aria-hidden className="size-5 shrink-0 animate-spin text-muted" />
        ) : (
          <Search aria-hidden className="size-5 shrink-0 text-muted" />
        )}
        <input
          id={inputId}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={text}
          placeholder={t('placeholder')}
          onChange={(event) => {
            setText(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            const [first] = places;
            if (event.key === 'Enter' && first) {
              event.preventDefault();
              choose(first);
            }
            if (event.key === 'Escape') setOpen(false);
          }}
          className="min-w-0 flex-1 bg-transparent py-3 text-ink placeholder:text-soft focus:outline-none"
        />
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          title={t('useMyLocation')}
          aria-label={t('useMyLocation')}
          className="-mr-1 rounded-pill p-2 text-ink transition-colors hover:bg-brand/30 disabled:opacity-50"
        >
          {locating ? (
            <LoaderCircle aria-hidden className="size-5 animate-spin" />
          ) : (
            <LocateFixed aria-hidden className="size-5" />
          )}
        </button>
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 overflow-hidden rounded-md border border-line bg-surface shadow-xl shadow-ink/10"
        >
          {places.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">{t('noPlaces')}</li>
          ) : (
            places.map((place) => (
              <li key={place.label} role="option" aria-selected={false}>
                <button
                  type="button"
                  // mousedown en vez de click: se ejecuta antes del blur del campo.
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(place);
                  }}
                  className="flex w-full items-start gap-2 px-4 py-3 text-left text-sm hover:bg-cream"
                >
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-text" />
                  {place.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      {locating && <p className="text-xs text-muted">{t('locating')}</p>}
      {locationError && <p className="text-xs text-danger">{t('locationDenied')}</p>}
    </div>
  );
}
