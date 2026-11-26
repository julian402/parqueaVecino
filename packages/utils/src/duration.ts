const UNIT_SECONDS = { s: 1, m: 60, h: 3600, d: 86_400 } as const;

/** Convierte "30s", "15m", "12h" o "7d" a segundos. Lanza error si el formato es inválido. */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Duración inválida: "${value}" (usa por ejemplo 30s, 15m, 12h, 7d)`);
  }
  const [, amount, unit] = match as unknown as [string, string, keyof typeof UNIT_SECONDS];
  return Number(amount) * UNIT_SECONDS[unit];
}
