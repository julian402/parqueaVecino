import {
  normalizePhone,
  normalizePlate,
  PLATE_RULES,
  type VehicleType,
} from '@parqueavecino/contracts';
import type { ChangeEvent, InputHTMLAttributes } from 'react';

/**
 * Atributos y máscaras de los campos con formato (placa, celular, correo, nombre): el teclado
 * correcto en el celular, autocompletado del navegador y el valor normalizado mientras se escribe.
 * La validación final la hacen los esquemas de `@parqueavecino/contracts`.
 */
type FieldProps = InputHTMLAttributes<HTMLInputElement>;

export const emailFieldProps = {
  type: 'email',
  inputMode: 'email',
  autoComplete: 'email',
  autoCapitalize: 'none',
  spellCheck: false,
} satisfies FieldProps;

export const nameFieldProps = {
  autoComplete: 'name',
  autoCapitalize: 'words',
  maxLength: 120,
} satisfies FieldProps;

export const phoneFieldProps = {
  type: 'tel',
  inputMode: 'tel',
  autoComplete: 'tel-national',
  maxLength: 16,
} satisfies FieldProps;

/** Placa o serial según el vehículo: mayúsculas, sin espacios y con su largo máximo. */
export function plateFieldProps(type: VehicleType) {
  return {
    placeholder: PLATE_RULES[type].example,
    maxLength: PLATE_RULES[type].maxLength,
    autoComplete: 'off',
    autoCapitalize: 'characters',
    autoCorrect: 'off',
    spellCheck: false,
    className: 'font-bold tracking-widest uppercase',
  } satisfies FieldProps;
}

/** Escribe "abc-123" → "ABC123", cortado al largo de la placa del vehículo. */
export function maskPlate(value: string, type: VehicleType): string {
  return normalizePlate(value).slice(0, PLATE_RULES[type].maxLength);
}

/** Agrupa el celular mientras se escribe: "3001234567" → "300 123 4567" (+57 se conserva). */
export function maskPhone(value: string): string {
  const normalized = normalizePhone(value);
  const international = normalized.startsWith('+');
  const digits = normalized.replace('+', '');
  const [prefix, local] =
    international || (digits.startsWith('57') && digits.length > 10)
      ? [`+${digits.slice(0, 2)} `, digits.slice(2)]
      : ['', digits];
  const ten = local.slice(0, 10);
  const groups = [ten.slice(0, 3), ten.slice(3, 6), ten.slice(6)].filter(Boolean).join(' ');
  return `${prefix}${groups}`.trimEnd();
}

/** Aplica una máscara a un `onChange` de react-hook-form conservando el evento. */
export function withMask<E extends ChangeEvent<HTMLInputElement>>(
  mask: (value: string) => string,
  onChange: (event: E) => unknown,
) {
  return (event: E) => {
    event.target.value = mask(event.target.value);
    void onChange(event);
  };
}
