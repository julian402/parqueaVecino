import type { Amenity, Shift, VehicleType } from '@parqueavecino/contracts';
import {
  Bike,
  Camera,
  Car,
  Clock,
  Moon,
  Motorbike,
  ShieldCheck,
  Sun,
  Umbrella,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Íconos del dominio, compartidos por todas las pantallas. */
export const SHIFT_ICONS: Record<Shift, LucideIcon> = { DAY: Sun, NIGHT: Moon, FULL: Clock };

export const VEHICLE_ICONS: Record<VehicleType, LucideIcon> = {
  CAR: Car,
  MOTORCYCLE: Motorbike,
  BICYCLE: Bike,
};

export const AMENITY_ICONS: Record<Amenity, LucideIcon> = {
  ROOF: Umbrella,
  SECURITY_24H: ShieldCheck,
  CAMERAS: Camera,
  BIKE_SPOT: Bike,
  EV_CHARGER: Zap,
};
