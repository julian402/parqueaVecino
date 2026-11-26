import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { LotDetail } from '@/features/parking-lot/components/lot-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('lot');
  return { title: t('metaTitle') };
}

export default async function ParkingLotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <LotDetail id={id} />
    </Suspense>
  );
}
