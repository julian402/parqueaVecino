import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CheckoutPage } from '@/features/booking/components/checkout-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout');
  return { title: t('metaTitle') };
}

export default async function CheckoutRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckoutPage id={id} />;
}
