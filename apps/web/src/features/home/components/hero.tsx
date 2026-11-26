import { getTranslations } from 'next-intl/server';
import { SearchCard } from './search-card';

/** Portada: mensaje del folleto, dato clave y tarjeta de búsqueda. */
export async function Hero() {
  const t = await getTranslations('home');
  return (
    <section className="relative overflow-hidden bg-cream">
      {/* Mancha decorativa amarilla, como el panel central del folleto. */}
      <div
        aria-hidden
        className="absolute -top-32 -right-32 size-96 rounded-full bg-brand/30 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:px-7 md:py-20">
        <div className="flex flex-col gap-6">
          <span className="w-fit rounded-pill bg-ink px-3 py-1 text-xs font-bold tracking-wide text-brand uppercase">
            {t('eyebrow')}
          </span>
          <h1 className="text-4xl leading-tight font-bold tracking-tight md:text-5xl">
            {t('titleStart')} <span className="text-brand-text">{t('titleHighlight')}</span>
          </h1>
          <p className="text-lg text-muted">{t('subtitle')}</p>

          <div className="flex items-center gap-5 rounded-md bg-ink p-5 text-ink-contrast">
            <span className="text-5xl font-bold whitespace-nowrap text-brand">
              {t('stat.value')}
            </span>
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-bold">{t('stat.label')}</span>
              <span className="text-soft">
                {t('stat.highlight')} {t('stat.detail')}
              </span>
            </div>
          </div>
        </div>
        <SearchCard />
      </div>
    </section>
  );
}
