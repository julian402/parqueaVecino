import { Logo } from '@parqueavecino/ui';
import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations();
  return (
    <footer className="bg-ink text-ink-contrast">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-7">
        <div className="flex flex-col gap-3">
          <Logo name={t('nav.brand')} variant="dark" showVehicles />
          <p className="max-w-sm text-sm text-soft">{t('footer.tagline')}</p>
        </div>
        <div className="flex flex-col gap-1 text-sm text-soft md:items-end">
          <span>{t('footer.demo')}</span>
          <span>{t('footer.rights')}</span>
        </div>
      </div>
    </footer>
  );
}
