import { describe, expect, it } from 'vitest';
import { parseSearchState, searchUrl } from './search-state';

describe('estado de búsqueda en la URL', () => {
  it('usa valores por defecto con una URL vacía', () => {
    expect(parseSearchState(new URLSearchParams())).toEqual({
      q: undefined,
      lat: undefined,
      lng: undefined,
      shift: 'NIGHT',
      vehicle: 'CAR',
      maxPrice: undefined,
      roof: false,
      sort: 'PRICE',
    });
  });

  it('ignora valores inválidos sin romper la página', () => {
    const state = parseSearchState(new URLSearchParams('shift=XX&lat=999&maxPrice=-5&roof=si'));
    expect(state).toMatchObject({
      shift: 'NIGHT',
      lat: undefined,
      maxPrice: undefined,
      roof: false,
    });
  });

  it('ida y vuelta: lo que se escribe en la URL se vuelve a leer igual', () => {
    const url = searchUrl({
      q: 'Chapinero',
      lat: 4.65,
      lng: -74.06,
      shift: 'DAY',
      vehicle: 'MOTORCYCLE',
      roof: true,
      sort: 'DISTANCE',
    });
    expect(url).toBe(
      '/buscar?q=Chapinero&lat=4.65&lng=-74.06&shift=DAY&vehicle=MOTORCYCLE&roof=1&sort=DISTANCE',
    );
    const state = parseSearchState(new URLSearchParams(url.split('?')[1]));
    expect(state).toMatchObject({ q: 'Chapinero', lat: 4.65, roof: true, sort: 'DISTANCE' });
  });

  it('omite filtros vacíos', () => {
    expect(searchUrl({ shift: 'NIGHT', roof: false, q: '' })).toBe('/buscar?shift=NIGHT');
  });
});
