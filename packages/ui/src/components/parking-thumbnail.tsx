import { SquareParking } from 'lucide-react';
import { cn } from '../lib/cn';

export type ParkingThumbnailProps = {
  /** Texto pequeño sobre la imagen (p. ej. el barrio). */
  caption?: string | null;
  /** Foto del parqueadero; sin ella se muestra la imagen provisional. */
  src?: string | null;
  /** Texto alternativo de la foto (p. ej. el nombre del parqueadero). */
  alt?: string;
  className?: string;
};

/** Foto de un parqueadero, o una imagen provisional si aún no tiene. */
export function ParkingThumbnail({ caption, src, alt = '', className }: ParkingThumbnailProps) {
  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-ink text-brand',
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <>
          <div
            aria-hidden
            className="absolute -right-6 -bottom-6 size-20 rounded-full bg-brand/20"
          />
          <SquareParking
            aria-hidden
            className="relative size-1/3 max-h-16 min-h-8"
            strokeWidth={1.75}
          />
        </>
      )}
      {caption && (
        <span className="absolute inset-x-0 bottom-0 truncate bg-ink/80 px-2 py-1 text-[11px] text-ink-contrast">
          {caption}
        </span>
      )}
    </div>
  );
}
