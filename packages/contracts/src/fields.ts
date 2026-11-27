import { z } from 'zod';
import { VehicleType } from './enums';

/**
 * Campos de formulario con formato colombiano, compartidos por la API y la web.
 * Cada campo normaliza lo que escribe la persona (espacios, guiones, mayúsculas) antes de validar,
 * y sus mensajes de error están en español.
 */

// Mensajes por defecto de Zod en español para lo que no tenga uno propio.
z.config(z.locales.es());

export const PASSWORD_MIN_LENGTH = 8;

/** Nombre de persona: letras (con tildes), espacios, apóstrofo, punto y guion. */
export const personNameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(2, 'Escribe tu nombre completo')
      .max(120, 'Máximo 120 caracteres')
      .regex(/^[\p{L}][\p{L}\s'.-]*$/u, 'Usa solo letras y espacios'),
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Escribe un correo válido, por ejemplo nombre@correo.com'));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(128, 'Máximo 128 caracteres')
  .regex(/[A-Za-z]/, 'Debe tener al menos una letra')
  .regex(/\d/, 'Debe tener al menos un número');

/** Quita lo que no es dígito ni el "+" inicial (espacios, guiones, paréntesis, puntos). */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  return (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '');
}

/**
 * Celular colombiano: 10 dígitos que empiezan por 3, con o sin +57.
 * Se guarda en formato internacional: +573001234567.
 */
export const phoneSchema = z
  .string()
  .transform(normalizePhone)
  .pipe(
    z
      .string()
      .regex(
        /^(\+?57)?3\d{9}$/,
        'Celular de 10 dígitos que empiece por 3, por ejemplo 300 123 4567',
      ),
  )
  .transform((value) => `+57${value.slice(-10)}`);

/** Muestra un celular guardado (+573001234567) como 300 123 4567. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10);
  return digits.length === 10
    ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
    : phone;
}

/** Placa o serial: sin espacios, guiones ni puntos y en mayúscula. */
export function normalizePlate(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Formato de identificación de cada tipo de vehículo en Colombia. */
export const PLATE_RULES = {
  /** Carro: 3 letras y 3 números. */
  [VehicleType.CAR]: {
    pattern: /^[A-Z]{3}\d{3}$/,
    maxLength: 6,
    example: 'ABC123',
    message: 'Placa de carro: 3 letras y 3 números, por ejemplo ABC123',
  },
  /** Moto: 3 letras, 2 números y una letra (las antiguas no tienen la letra final). */
  [VehicleType.MOTORCYCLE]: {
    pattern: /^[A-Z]{3}\d{2}[A-Z]?$/,
    maxLength: 6,
    example: 'ABC12D',
    message: 'Placa de moto: 3 letras, 2 números y una letra, por ejemplo ABC12D',
  },
  /** Bicicleta: no tiene placa; se usa el serial del marco o el registro de la bici. */
  [VehicleType.BICYCLE]: {
    pattern: /^[A-Z0-9]{4,20}$/,
    maxLength: 20,
    example: 'WTU123456',
    message: 'Serial o registro de la bicicleta: de 4 a 20 letras o números',
  },
} as const satisfies Record<
  VehicleType,
  { pattern: RegExp; maxLength: number; example: string; message: string }
>;

/** Cualquier placa o serial válido (el formato exacto depende del vehículo: `plateSchemaFor`). */
export const plateSchema = z
  .string()
  .transform(normalizePlate)
  .pipe(z.string().regex(/^[A-Z0-9]{4,20}$/, 'Escribe la placa del vehículo'));

/** Placa con el formato del tipo de vehículo (carro ABC123, moto ABC12D, bici serial). */
export function plateSchemaFor(type: VehicleType) {
  const rule = PLATE_RULES[type];
  return z.string().transform(normalizePlate).pipe(z.string().regex(rule.pattern, rule.message));
}

/** Mensaje de error si la placa no corresponde al tipo de vehículo; null si es válida. */
export function plateError(type: VehicleType, plate: string): string | null {
  const result = plateSchemaFor(type).safeParse(plate);
  return result.success ? null : (result.error.issues[0]?.message ?? PLATE_RULES[type].message);
}
