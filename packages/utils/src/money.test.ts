import { describe, expect, it } from 'vitest';
import { currencyFractionDigits, formatMoney, percentageOf, toMinorUnits } from './money';
import { hourInTimeZone } from './date';

describe('money', () => {
  it('convierte a unidades menores según la moneda', () => {
    expect(toMinorUnits(170000, 'COP')).toBe(17_000_000);
  });

  it('fija los decimales ISO 4217 de COP (2) aunque el ICU del entorno diga otra cosa', () => {
    expect(currencyFractionDigits('COP')).toBe(2);
    expect(currencyFractionDigits('cop')).toBe(2);
  });

  it('formatea COP sin centavos', () => {
    expect(formatMoney(17_000_000, 'COP', { locale: 'es-CO' })).toMatch(/170\.000/);
  });

  it('calcula la comisión en puntos básicos', () => {
    expect(percentageOf(17_000_000, 1000)).toBe(1_700_000);
  });
});

describe('date', () => {
  it('calcula la hora en la zona indicada', () => {
    expect(hourInTimeZone(new Date('2026-12-01T23:00:00Z'), 'America/Bogota')).toBe(18);
  });
});
