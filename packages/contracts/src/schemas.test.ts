import { describe, expect, it } from 'vitest';
import {
  guestBookingSchema,
  offerInputSchema,
  plateSchema,
  registerSchema,
  upsertOffersSchema,
} from './index';

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

  it('reserva como invitado con las reglas del registro y la placa', () => {
    const guest = {
      fullName: 'Ana Pérez',
      email: ' ANA@mail.com',
      password: 'clave1234',
      plate: 'abc-123',
    };
    expect(guestBookingSchema.parse(guest)).toEqual({
      fullName: 'Ana Pérez',
      email: 'ana@mail.com',
      password: 'clave1234',
      plate: 'ABC123',
    });
    expect(() => guestBookingSchema.parse({ ...guest, password: 'corta' })).toThrow();
    expect(() => guestBookingSchema.parse({ ...guest, plate: '12ABC' })).toThrow();
  });
});
