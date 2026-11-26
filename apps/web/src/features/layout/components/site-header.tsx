import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { routes } from '@/lib/routes';
import { UserMenu } from './user-menu';

export async function SiteHeader() {
  const t = await getTranslations('nav');
  return (
    <header className="flex items-center gap-6 border-b-2 border-line px-4 py-3 md:px-7">
      <Link href={routes.home} className="rounded-sm border-2 border-ink px-2.5 py-1 font-bold">
        {t('brand')}
      </Link>
      <nav className="ml-auto hidden items-center gap-5 text-muted md:flex">
        <Link href={routes.home} className="text-ink">
          {t('search')}
        </Link>
        <span>{t('howItWorks')}</span>
        <span>{t('forPartners')}</span>
        <UserMenu />
      </nav>
      <div className="ml-auto md:hidden">
        <UserMenu />
      </div>
    </header>
  );
}
