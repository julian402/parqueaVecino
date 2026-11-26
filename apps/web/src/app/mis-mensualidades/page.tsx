import { getTranslations } from 'next-intl/server';

export default async function ComingSoonPage() {
  const t = await getTranslations();
  return <p className="px-4 py-10 text-center text-muted">{t('comingSoon')}</p>;
}
