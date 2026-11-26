import { Logo } from '@parqueavecino/ui';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { routes } from '@/lib/routes';
import { UserMenu } from './user-menu';

export async function SiteHeader() {
  const t = await getTranslations('nav');
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 md:px-7">
        <Link href={routes.home} aria-label={t('brand')}>
          <Logo name={t('brand')} />
        </Link>
        <nav className="ml-auto hidden items-center gap-6 text-sm font-bold text-muted md:flex">
          <Link href={routes.home} className="hover:text-ink">
            {t('search')}
          </Link>
          <Link href={routes.howItWorks} className="hover:text-ink">
            {t('howItWorks')}
          </Link>
          <Link href={routes.forPartners} className="hover:text-ink">
            {t('forPartners')}
          </Link>
        </nav>
        <div className="ml-auto md:ml-0">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
