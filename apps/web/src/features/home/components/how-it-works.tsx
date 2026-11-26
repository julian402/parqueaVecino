import { getTranslations } from 'next-intl/server';

const STEPS = ['1', '2', '3'] as const;

/** "Ingresa, busca tu parqueadero, selecciona y paga": banda azul del folleto. */
export async function HowItWorks() {
  const t = await getTranslations('home.steps');
  return (
    <section id="como-funciona" className="bg-ink text-ink-contrast">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-16 md:px-7">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight">{t('title')}</h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step} className="flex items-center gap-4">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-brand text-2xl font-bold text-ink">
                {step}
              </span>
              <div className="flex flex-col">
                <span className="text-xs font-bold tracking-wide text-brand uppercase">
                  {t('label', { number: step })}
                </span>
                <span className="text-lg font-bold">{t(`items.${step}`)}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
