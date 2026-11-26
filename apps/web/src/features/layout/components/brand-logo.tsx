import { cn } from '@parqueavecino/ui';
import Image from 'next/image';
import { brandAssets } from '@/lib/routes';

/** Logo oficial (pin + carro, moto y bici sobre amarillo). La altura la define `className`. */
export function BrandLogo({
  alt,
  className,
  priority = false,
}: {
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const { src, width, height } = brandAssets.logo;
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      loading={priority ? 'eager' : undefined}
      className={cn('h-10 w-auto rounded-sm', className)}
    />
  );
}
