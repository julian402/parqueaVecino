import { CircleCheck } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

const BENEFITS = ['savings', 'map', 'inclusive', 'verified'] as const;

/** "¿Por qué elegirnos?": banda amarilla del folleto. */
export async function Benefits() {
  const t = await getTranslations('home');
  return (
    <section className="bg-brand">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1fr_2fr] md:px-7">
        <div className="flex flex-col gap-4">
          <h2 className="text-3xl font-bold tracking-tight">{t('benefits.title')}</h2>
          <p className="text-xl font-bold">{t('closing')}</p>
        </div>
        <ul className="grid gap-6 sm:grid-cols-2">
          {BENEFITS.map((key) => (
            <li key={key} className="flex gap-3">
              <CircleCheck aria-hidden className="size-7 shrink-0 fill-ink text-brand" />
              <div className="flex flex-col gap-1">
                <span className="font-bold">{t(`benefits.items.${key}.title`)}</span>
                <span className="text-sm">{t(`benefits.items.${key}.detail`)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
