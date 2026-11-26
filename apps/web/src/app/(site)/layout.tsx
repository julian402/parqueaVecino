import type { ReactNode } from 'react';
import { MobileTabBar } from '@/features/layout/components/mobile-tab-bar';
import { SiteFooter } from '@/features/layout/components/site-footer';
import { SiteHeader } from '@/features/layout/components/site-header';

/** Sitio público y pantallas del conductor: encabezado, pie y barra inferior en celular. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="min-h-[60vh]">{children}</main>
      <SiteFooter />
      {/* Espacio para que la barra inferior no tape el pie en celular. */}
      <div aria-hidden className="h-16 md:hidden" />
      <MobileTabBar />
    </>
  );
}
