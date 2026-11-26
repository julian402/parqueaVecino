'use client';

import { Button } from '@parqueavecino/ui';
import { List, LoaderCircle, Map as MapIcon, SearchX } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useParkingLotsSearch } from '@/lib/api/generated/parking-lots/parking-lots';
import { useSettingsGetPublic } from '@/lib/api/generated/settings/settings';
import { routes } from '@/lib/routes';
import { parseSearchState, searchUrl, type SearchState } from '../lib/search-state';
import { PlaceSearch } from './place-search';
import { ResultCard } from './result-card';
import { SearchFilters } from './search-filters';

// MapLibre usa window/WebGL: solo en el navegador.
const ResultsMap = dynamic(() => import('./results-map'), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-fill" />,
});

/** Pantalla de resultados (mockup 2): filtros + lista a la izquierda, mapa a la derecha. */
export function SearchPage() {
  const t = useTranslations('search');
  const tEnums = useTranslations('enums');
  const router = useRouter();
  const params = useSearchParams();
  const state = useMemo(() => parseSearchState(new URLSearchParams(params)), [params]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // En celular se alterna entre lista y mapa; en escritorio se ven ambos.
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');

  const { data: settings } = useSettingsGetPublic();
  const center = settings?.['search.defaultCenter'];
  const origin = useMemo(
    () =>
      state.lat !== undefined && state.lng !== undefined
        ? { latitude: state.lat, longitude: state.lng }
        : center
          ? { latitude: center.latitude, longitude: center.longitude }
          : null,
    [state.lat, state.lng, center],
  );

  const search = useParkingLotsSearch(
    {
      lat: origin?.latitude ?? 0,
      lng: origin?.longitude ?? 0,
      shift: state.shift,
      vehicleType: state.vehicle,
      maxPriceMinor: state.maxPrice,
      amenities: state.roof ? ['ROOF'] : undefined,
      sort: state.sort,
    },
    { query: { enabled: origin !== null, placeholderData: (previous) => previous } },
  );
  const results = useMemo(() => search.data?.results ?? [], [search.data]);

  const update = (patch: Partial<SearchState>) => {
    router.replace(searchUrl({ ...state, ...patch }), { scroll: false });
  };

  // La ficha recibe la búsqueda para mostrar la distancia y volver con los mismos filtros.
  const detailHref = (id: string) => `${routes.parkingLot(id)}?${params.toString()}`;

  const selectFromMap = (id: string) => {
    setActiveId(id);
    if (mobileView === 'map') {
      router.push(detailHref(id));
      return;
    }
    document.getElementById(`lot-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] md:h-[calc(100dvh-4rem)] md:grid-cols-[minmax(0,26rem)_1fr] lg:grid-cols-[minmax(0,30rem)_1fr]">
      <section className="flex min-h-0 flex-col gap-4 px-4 py-5 md:overflow-y-auto md:pr-5">
        <PlaceSearch
          key={state.q ?? center?.label}
          defaultValue={state.q ?? center?.label ?? ''}
          onSelect={(place) =>
            update({ q: place.label, lat: place.latitude, lng: place.longitude })
          }
        />
        <SearchFilters state={state} onChange={update} />

        <div className="flex items-center justify-between gap-2" aria-live="polite">
          <p className="text-sm font-bold">
            {search.data
              ? t('summary', {
                  lots: search.data.totalLots,
                  spots: search.data.totalAvailableSpots,
                  shift: tEnums(`shiftPlural.${state.shift}`),
                })
              : t('loading')}
          </p>
          {search.isFetching && (
            <LoaderCircle aria-label={t('loading')} className="size-4 animate-spin text-muted" />
          )}
        </div>

        {/* En celular el mapa reemplaza a la lista cuando se elige "Ver mapa". */}
        <div className={mobileView === 'map' ? 'hidden md:block' : 'contents'}>
          {search.isError ? (
            <p className="rounded-md bg-danger/10 p-4 text-sm text-danger">{t('error')}</p>
          ) : search.data && results.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-md bg-surface-muted p-8 text-center">
              <SearchX aria-hidden className="size-8 text-muted" />
              <p className="font-bold">{t('emptyTitle')}</p>
              <p className="text-sm text-muted">{t('emptyHint')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {(search.data ? results : Array.from({ length: 3 }, () => null)).map(
                (result, index) =>
                  result ? (
                    <li key={result.id}>
                      <ResultCard
                        result={result}
                        href={detailHref(result.id)}
                        active={activeId === result.id}
                        onHover={(hovering) => setActiveId(hovering ? result.id : null)}
                      />
                    </li>
                  ) : (
                    <li key={index} className="h-32 animate-pulse rounded-md bg-fill" />
                  ),
              )}
            </ul>
          )}
          <p className="text-center text-xs text-muted">{t('mapLegend')}</p>
        </div>
      </section>

      <section
        className={
          mobileView === 'map' ? 'h-[70dvh] px-4 pb-4 md:h-auto md:p-0' : 'hidden md:block'
        }
      >
        {origin && (
          <ResultsMap
            origin={origin}
            results={results}
            activeId={activeId}
            onActivate={setActiveId}
            onSelect={selectFromMap}
            className="size-full rounded-md md:rounded-none"
          />
        )}
      </section>

      {/* Botón flotante lista ↔ mapa (solo celular), sobre la barra inferior. */}
      <div className="fixed inset-x-0 bottom-20 z-20 flex justify-center md:hidden">
        <Button
          variant="primary"
          onClick={() => setMobileView(mobileView === 'list' ? 'map' : 'list')}
          className="shadow-xl shadow-ink/30"
        >
          {mobileView === 'list' ? (
            <MapIcon aria-hidden className="size-4" />
          ) : (
            <List aria-hidden className="size-4" />
          )}
          {mobileView === 'list' ? t('viewMap') : t('viewList')}
        </Button>
      </div>
    </div>
  );
}
