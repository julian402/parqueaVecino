import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { SearchPage } from '@/features/search/components/search-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('search');
  return { title: t('metaTitle') };
}

export default function BuscarPage() {
  // useSearchParams requiere Suspense para no forzar todo el render al cliente.
  return (
    <Suspense>
      <SearchPage />
    </Suspense>
  );
}
