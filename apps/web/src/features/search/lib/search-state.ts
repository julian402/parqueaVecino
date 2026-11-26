import { SearchSort, Shift, VehicleType } from '@parqueavecino/contracts';
import { z } from 'zod';
import { routes } from '@/lib/routes';

/**
 * Estado de la búsqueda guardado en la URL (/buscar?q=Chapinero&shift=NIGHT...):
 * se puede compartir, recargar y volver atrás sin perder filtros.
 * Valores inválidos en la URL no rompen la página: vuelven al valor por defecto.
 */
export const searchStateSchema = z.object({
  q: z.string().trim().max(120).optional().catch(undefined),
  lat: z.coerce.number().min(-90).max(90).optional().catch(undefined),
  lng: z.coerce.number().min(-180).max(180).optional().catch(undefined),
  shift: z.enum(Shift).catch(Shift.NIGHT),
  vehicle: z.enum(VehicleType).catch(VehicleType.CAR),
  maxPrice: z.coerce.number().int().positive().optional().catch(undefined),
  roof: z
    .enum(['1'])
    .optional()
    .catch(undefined)
    .transform((value) => value === '1'),
  sort: z.enum(SearchSort).catch(SearchSort.PRICE),
});
export type SearchState = z.output<typeof searchStateSchema>;

export function parseSearchState(params: URLSearchParams): SearchState {
  return searchStateSchema.parse(Object.fromEntries(params.entries()));
}

/** URL de /buscar con los valores dados (omite los vacíos). */
export function searchUrl(state: Partial<SearchState>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state)) {
    if (value === undefined || value === false || value === '') continue;
    params.set(key, value === true ? '1' : String(value));
  }
  const query = params.toString();
  return query ? `${routes.search}?${query}` : routes.search;
}
