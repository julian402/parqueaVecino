import { buttonVariants } from '@parqueavecino/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function SiteHeader() {
  const t = await getTranslations('nav');
  return (
    <header className="flex items-center gap-6 border-b-2 border-line px-4 py-3 md:px-7">
      <Link href="/" className="rounded-sm border-2 border-ink px-2.5 py-1 font-bold">
        {t('brand')}
      </Link>
      <nav className="ml-auto hidden items-center gap-5 text-muted md:flex">
        <Link href="/" className="text-ink">
          {t('search')}
        </Link>
        <span>{t('howItWorks')}</span>
        <span>{t('forPartners')}</span>
        <Link href="/" className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
          {t('signIn')}
        </Link>
      </nav>
    </header>
  );
}
