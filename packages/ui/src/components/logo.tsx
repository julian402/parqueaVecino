import { Bike, Car, MapPin } from 'lucide-react';
import { cn } from '../lib/cn';

export type LogoProps = {
  /** Nombre de la marca (viene de los textos de la app, no se quema aquí). */
  name: string;
  /** `light` sobre fondos claros, `dark` sobre fondos azules. */
  variant?: 'light' | 'dark';
  /** Muestra los vehículos (carro y bici) junto al pin, como en el folleto. */
  showVehicles?: boolean;
  className?: string;
};

/** Logo del folleto: pin amarillo + vehículos + nombre. */
export function Logo({ name, variant = 'light', showVehicles = false, className }: LogoProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-bold',
        variant === 'dark' ? 'text-ink-contrast' : 'text-ink',
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-md bg-ink text-brand">
        <MapPin aria-hidden className="size-5" strokeWidth={2.5} />
      </span>
      <span className="text-lg tracking-tight">{name}</span>
      {showVehicles && (
        <span aria-hidden className="flex items-center gap-1 text-brand">
          <Car className="size-4" />
          <Bike className="size-4" />
        </span>
      )}
    </span>
  );
}
