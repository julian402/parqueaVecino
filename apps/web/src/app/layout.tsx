import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { MobileTabBar } from '@/features/layout/components/mobile-tab-bar';
import { SiteFooter } from '@/features/layout/components/site-footer';
import { SiteHeader } from '@/features/layout/components/site-header';
import { Providers } from './providers';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('title'), description: t('description') };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <Providers>
            <SiteHeader />
            {/* Espacio para la barra inferior en celular. */}
            <main className="min-h-[60vh]">{children}</main>
            <SiteFooter />
            {/* Espacio para que la barra inferior no tape el pie en celular. */}
            <div aria-hidden className="h-16 md:hidden" />
            <MobileTabBar />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
