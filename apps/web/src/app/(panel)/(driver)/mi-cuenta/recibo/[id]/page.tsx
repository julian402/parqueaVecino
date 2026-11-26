import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ReceiptView } from '@/features/booking/components/receipt-view';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('receipt');
  return { title: t('metaTitle') };
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptView bookingId={id} />;
}
