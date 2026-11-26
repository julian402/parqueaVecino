import { describe, expect, it } from 'vitest';
import { parseDurationToSeconds } from './duration';

describe('parseDurationToSeconds', () => {
  it('convierte las unidades soportadas', () => {
    expect(parseDurationToSeconds('30s')).toBe(30);
    expect(parseDurationToSeconds('15m')).toBe(900);
    expect(parseDurationToSeconds('12h')).toBe(43_200);
    expect(parseDurationToSeconds('7d')).toBe(604_800);
  });

  it('rechaza formatos inválidos', () => {
    expect(() => parseDurationToSeconds('7 días')).toThrow(/inválida/);
  });
});
