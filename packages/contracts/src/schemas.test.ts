import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  formatPhone,
  guestBookingSchema,
  passwordSchema,
  personNameSchema,
  phoneSchema,
  plateSchemaFor,
  vehicleInputSchema,
  offerInputSchema,
  plateSchema,
  registerSchema,
  upsertOffersSchema,
} from './index';

describe('esquemas', () => {
  it('normaliza la placa y exige el formato de cada vehículo', () => {
    expect(plateSchema.parse('abc 123')).toBe('ABC123');
    expect(plateSchemaFor('CAR').parse('abc-123')).toBe('ABC123');
    expect(plateSchemaFor('MOTORCYCLE').parse('xyz 12d')).toBe('XYZ12D');
    expect(plateSchemaFor('MOTORCYCLE').parse('xyz12')).toBe('XYZ12');
    expect(plateSchemaFor('BICYCLE').parse('wtu-1234.56')).toBe('WTU123456');
    expect(() => plateSchemaFor('CAR').parse('ABC12D')).toThrow(/carro/);
    expect(() => plateSchemaFor('MOTORCYCLE').parse('ABC123')).toThrow(/moto/);
    expect(() => plateSchemaFor('CAR').parse('12ABC')).toThrow();
    expect(
      vehicleInputSchema.safeParse({ plate: 'ABC12D', type: 'CAR' }).error?.issues[0],
    ).toMatchObject({ path: ['plate'] });
    expect(vehicleInputSchema.parse({ plate: 'abc 12d', type: 'MOTORCYCLE' }).plate).toBe('ABC12D');
  });

  it('acepta celulares colombianos y los guarda con +57', () => {
    expect(phoneSchema.parse('300 123 4567')).toBe('+573001234567');
    expect(phoneSchema.parse('+57 (310) 555-0000')).toBe('+573105550000');
    expect(phoneSchema.parse('573001234567')).toBe('+573001234567');
    expect(() => phoneSchema.parse('6011234567')).toThrow(/empiece por 3/);
    expect(() => phoneSchema.parse('300123')).toThrow();
    expect(formatPhone('+573001234567')).toBe('300 123 4567');
  });

  it('valida nombres y correos con mensajes en español', () => {
    expect(personNameSchema.parse('  Ana   María  Pérez ')).toBe('Ana María Pérez');
    expect(personNameSchema.parse("D'Angelo O.")).toBe("D'Angelo O.");
    expect(() => personNameSchema.parse('Ana123')).toThrow(/solo letras/);
    expect(() => emailSchema.parse('ana@')).toThrow(/correo válido/);
    expect(() => passwordSchema.parse('abc1')).toThrow(/Mínimo 8/);
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
    expect(() => guestBookingSchema.parse({ ...guest, plate: 'A-1' })).toThrow();
  });
});
