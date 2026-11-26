import { MapPin } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { routes } from '@/lib/routes';
import { BrandLogo } from './brand-logo';

const COLUMNS = [
  {
    key: 'drivers',
    links: [
      { key: 'search', href: routes.search },
      { key: 'myBookings', href: routes.myBookings },
      { key: 'howItWorks', href: routes.howItWorks },
    ],
  },
  {
    key: 'partners',
    links: [
      { key: 'publish', href: routes.forPartners },
      { key: 'panel', href: routes.partner.overview },
      { key: 'benefits', href: routes.benefits },
    ],
  },
  {
    key: 'account',
    links: [
      { key: 'signIn', href: routes.login },
      { key: 'register', href: routes.register },
      { key: 'profile', href: routes.profile },
    ],
  },
] as const;

export async function SiteFooter() {
  const t = await getTranslations();
  return (
    <footer className="relative overflow-hidden bg-ink text-ink-contrast">
      {/* Línea amarilla superior: el mismo acento del folleto. */}
      <div aria-hidden className="h-1 bg-brand" />
      <div
        aria-hidden
        className="absolute -bottom-40 -left-40 size-96 rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-7">
        <div className="flex flex-col gap-4">
          <Link href={routes.home} aria-label={t('nav.brand')} className="w-fit">
            <BrandLogo alt={t('nav.brand')} className="h-12" />
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-soft">{t('footer.tagline')}</p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.key} aria-label={t(`footer.columns.${column.key}.title`)}>
            <h2 className="mb-4 text-xs font-bold tracking-widest text-brand uppercase">
              {t(`footer.columns.${column.key}.title`)}
            </h2>
            <ul className="flex flex-col gap-3 text-sm">
              {column.links.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-soft transition-colors hover:text-ink-contrast"
                  >
                    {t(`footer.columns.${column.key}.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="relative border-t border-ink-contrast/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-soft sm:flex-row sm:items-center sm:justify-between md:px-7">
          <span>{t('footer.copyright', { year: new Date().getFullYear() })}</span>
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="size-3.5 text-brand" />
            {t('footer.madeIn')}
          </span>
        </div>
      </div>
    </footer>
  );
}
