import { Bike, Clock, MapPinned, PiggyBank, ShieldCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

const BENEFITS = [
  { key: 'savings', Icon: PiggyBank },
  { key: 'map', Icon: MapPinned },
  { key: 'inclusive', Icon: Bike },
  { key: 'verified', Icon: ShieldCheck },
] as const;

/** "¿Por qué elegirnos?": tarjetas de beneficios y el dato de las 100 horas destacado. */
export async function Benefits() {
  const t = await getTranslations('home.benefits');
  return (
    <section id="beneficios" className="bg-cream">
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-4 py-20 md:px-7">
        <div className="flex max-w-2xl flex-col gap-3">
          <span className="text-xs font-bold tracking-widest text-brand-text uppercase">
            {t('eyebrow')}
          </span>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t('title')}</h2>
          <p className="text-muted">{t('subtitle')}</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
          {/* Dato destacado (folleto: "Recupera tus 100 horas"). */}
          <div className="relative flex flex-col justify-between gap-8 overflow-hidden rounded-xl bg-brand p-8">
            <Clock
              aria-hidden
              className="absolute -right-10 -bottom-10 size-48 text-ink/10"
              strokeWidth={1.5}
            />
            <span className="text-6xl font-bold tracking-tight md:text-7xl">
              {t('highlight.value')}
            </span>
            <div className="relative flex flex-col gap-2">
              <span className="text-xl font-bold">{t('highlight.label')}</span>
              <span className="text-sm">{t('highlight.detail')}</span>
            </div>
          </div>

          <ul className="grid gap-5 sm:grid-cols-2">
            {BENEFITS.map(({ key, Icon }) => (
              <li
                key={key}
                className="group flex flex-col gap-4 rounded-lg border border-line bg-surface p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-ink/10"
              >
                <span className="flex size-12 items-center justify-center rounded-md bg-ink text-brand transition-colors group-hover:bg-brand group-hover:text-ink">
                  <Icon aria-hidden className="size-6" />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-lg font-bold">{t(`items.${key}.title`)}</h3>
                  <p className="text-sm leading-relaxed text-muted">{t(`items.${key}.detail`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
