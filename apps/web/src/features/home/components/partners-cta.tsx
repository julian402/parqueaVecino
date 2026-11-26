import { buttonVariants } from '@parqueavecino/ui';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { routes } from '@/lib/routes';

/** Invitación a los dueños de parqueaderos (lado oferta del marketplace). */
export async function PartnersCta() {
  const t = await getTranslations('home.partners');
  return (
    <section id="aliados" className="mx-auto max-w-6xl px-4 py-16 md:px-7">
      <div className="flex flex-col items-start gap-6 rounded-md border border-line bg-cream p-8 md:flex-row md:items-center md:justify-between md:p-10">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-ink text-brand">
            <Building2 aria-hidden className="size-6" />
          </span>
          <div className="flex max-w-xl flex-col gap-2">
            <h2 className="text-2xl font-bold">{t('title')}</h2>
            <p className="text-muted">{t('subtitle')}</p>
          </div>
        </div>
        <Link href={routes.register} className={buttonVariants({ size: 'lg' })}>
          {t('cta')}
        </Link>
      </div>
    </section>
  );
}
