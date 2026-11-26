import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { MobileTabBar } from '@/features/layout/components/mobile-tab-bar';
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
            <main className="pb-20 md:pb-0">{children}</main>
            <MobileTabBar />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
