import { describe, expect, it } from 'vitest';
import { distanceBetween, formatDistance } from './distance';
import { formatCompactMoney } from './money';

describe('formatDistance', () => {
  it('muestra metros redondeados a la decena bajo 1 km', () => {
    expect(formatDistance(347, 'es-CO')).toBe('350 m');
  });

  it('muestra kilómetros con un decimal desde 1 km', () => {
    expect(formatDistance(1240, 'es-CO')).toBe('1,2 km');
  });
});

describe('formatCompactMoney', () => {
  it('abrevia precios para los marcadores del mapa', () => {
    // El sufijo exacto ("mil" o "K") depende de los datos ICU del entorno.
    const compact = formatCompactMoney(17_000_000, 'COP', { locale: 'es-CO' });
    expect(compact).toMatch(/170/);
    expect(compact).not.toMatch(/000/);
  });
});

describe('distanceBetween', () => {
  it('calcula la distancia entre dos puntos de Bogotá (~1,1 km por centésima de grado)', () => {
    const meters = distanceBetween(
      { latitude: 4.65, longitude: -74.06 },
      { latitude: 4.66, longitude: -74.06 },
    );
    expect(meters).toBeGreaterThan(1100);
    expect(meters).toBeLessThan(1115);
  });

  it('es cero para el mismo punto', () => {
    expect(
      distanceBetween({ latitude: 4.6, longitude: -74 }, { latitude: 4.6, longitude: -74 }),
    ).toBe(0);
  });
});
