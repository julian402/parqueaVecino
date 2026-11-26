import { describe, expect, it } from 'vitest';
import { offerInputSchema, plateSchema, registerSchema, upsertOffersSchema } from './index';

describe('esquemas', () => {
  it('normaliza la placa', () => {
    expect(plateSchema.parse('abc 123')).toBe('ABC123');
    expect(plateSchema.parse('xyz-12d')).toBe('XYZ12D');
    expect(() => plateSchema.parse('12ABC')).toThrow();
  });

  it('no permite registrarse como admin', () => {
    const base = { fullName: 'Ana Pérez', email: 'ANA@mail.com ', password: 'clave1234' };
    expect(registerSchema.parse({ ...base, role: 'DRIVER' }).email).toBe('ana@mail.com');
    expect(() => registerSchema.parse({ ...base, role: 'ADMIN' })).toThrow();
  });

  it('no acepta la misma franja y vehículo dos veces al publicar cupos', () => {
    const offer = {
      shift: 'NIGHT',
      vehicleType: 'CAR',
      totalSpots: 5,
      monthlyPriceMinor: 17_000_000,
    };
    expect(offerInputSchema.parse(offer).active).toBe(true);
    expect(() => upsertOffersSchema.parse({ offers: [offer, offer] })).toThrow(/repetidas/);
  });
});
