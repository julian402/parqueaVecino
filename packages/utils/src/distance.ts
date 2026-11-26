/** Distancia legible: 350 → "350 m", 1240 → "1,2 km" (según el locale). */
export function formatDistance(meters: number, locale: string): string {
  if (meters < 1000) {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'meter' }).format(
      Math.round(meters / 10) * 10,
    );
  }
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'kilometer',
    maximumFractionDigits: 1,
  }).format(meters / 1000);
}

const EARTH_RADIUS_METERS = 6_371_008.8;

export type Coordinates = { latitude: number; longitude: number };

/** Distancia en línea recta (haversine) entre dos puntos, en metros. */
export function distanceBetween(a: Coordinates, b: Coordinates): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}
