'use client';

import { cn } from '@parqueavecino/ui';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSettingsGetPublic } from '@/lib/api/generated/settings/settings';

const SHIFTS = [
  { key: 'DAY', Icon: Sun, className: 'bg-brand text-ink' },
  { key: 'NIGHT', Icon: Moon, className: 'bg-ink text-ink-contrast' },
] as const;

/** Franjas diurna y nocturna. Los horarios salen de system_settings (no se queman en la web). */
export function ShiftsSection() {
  const t = useTranslations('home.shifts');
  const { data: settings } = useSettingsGetPublic();
  const schedule = settings?.['shift.schedule'];

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 md:px-7">
      <div className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
        <p className="text-muted">{t('subtitle')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {SHIFTS.map(({ key, Icon, className }) => {
          const hours = schedule?.[key];
          return (
            <div key={key} className={cn('flex items-center gap-5 rounded-md p-6', className)}>
              <span className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-surface/20">
                <Icon aria-hidden className="size-7" />
              </span>
              <div className="flex flex-col gap-1">
                <span className="text-xl font-bold">
                  {t(`${key}.name`)} · {t(`${key}.detail`)}
                </span>
                {hours && (
                  <span className="text-sm opacity-80">
                    {t('hours', { start: hours.start, end: hours.end })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
