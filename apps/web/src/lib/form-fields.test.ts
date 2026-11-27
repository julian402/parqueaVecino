import { describe, expect, it } from 'vitest';
import { maskPhone, maskPlate } from './form-fields';

describe('máscaras de campos', () => {
  it('normaliza la placa al largo de cada vehículo', () => {
    expect(maskPlate('abc-1234', 'CAR')).toBe('ABC123');
    expect(maskPlate('xyz 12d', 'MOTORCYCLE')).toBe('XYZ12D');
    expect(maskPlate('wtu.123-456', 'BICYCLE')).toBe('WTU123456');
  });

  it('agrupa el celular mientras se escribe', () => {
    expect(maskPhone('300')).toBe('300');
    expect(maskPhone('3001')).toBe('300 1');
    expect(maskPhone('300-123-45678')).toBe('300 123 4567');
    expect(maskPhone('+57 3001234567')).toBe('+57 300 123 4567');
    expect(maskPhone('573001234567')).toBe('+57 300 123 4567');
    expect(maskPhone('abc')).toBe('');
  });
});
