import { buttonVariants } from '@parqueavecino/ui';
import { ArrowRight, CreditCard, MapPinned, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { routes } from '@/lib/routes';

const STEPS = [
  { key: '1', Icon: Smartphone },
  { key: '2', Icon: MapPinned },
  { key: '3', Icon: CreditCard },
] as const;

/** "Cómo funciona": tres pasos en tarjetas sobre la banda azul del folleto. */
export async function HowItWorks() {
  const t = await getTranslations('home.steps');
  return (
    <section id="como-funciona" className="relative overflow-hidden bg-ink text-ink-contrast">
      <div
        aria-hidden
        className="absolute -top-24 right-0 size-96 rounded-full bg-brand/15 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 md:px-7">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-xl flex-col gap-3">
            <span className="text-xs font-bold tracking-widest text-brand uppercase">
              {t('eyebrow')}
            </span>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('title')}</h2>
            <p className="text-soft">{t('subtitle')}</p>
          </div>
          <Link href={routes.search} className={buttonVariants({ variant: 'accent' })}>
            {t('cta')}
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>

        <ol className="grid gap-5 md:grid-cols-3">
          {STEPS.map(({ key, Icon }) => (
            <li
              key={key}
              className="group relative flex flex-col gap-5 rounded-lg border border-ink-contrast/10 bg-ink-contrast/5 p-6 backdrop-blur transition-colors hover:border-brand/50 hover:bg-ink-contrast/10"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-12 items-center justify-center rounded-md bg-brand text-ink transition-transform group-hover:-rotate-6">
                  <Icon aria-hidden className="size-6" />
                </span>
                <span
                  aria-hidden
                  className="text-5xl font-bold text-ink-contrast/10 transition-colors group-hover:text-brand/30"
                >
                  0{key}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-bold tracking-widest text-brand uppercase">
                  {t('label', { number: key })}
                </span>
                <h3 className="text-xl font-bold">{t(`items.${key}.title`)}</h3>
                <p className="text-sm leading-relaxed text-soft">{t(`items.${key}.detail`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
