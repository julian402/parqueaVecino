'use client';

import { cn } from '@parqueavecino/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { routes } from '@/lib/routes';

const tabs = [
  { href: routes.home, label: 'search' },
  { href: routes.myBookings, label: 'myBookings' },
  { href: routes.profile, label: 'profile' },
] as const;

/** Barra inferior en celular (mockups 375 px). En escritorio se oculta. */
export function MobileTabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 flex h-16 items-center justify-around border-t-2 border-line bg-surface md:hidden">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 text-[10px]',
              active ? 'font-bold text-ink' : 'text-muted',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-5 rounded-sm border-2',
                active ? 'border-ink bg-ink' : 'border-muted',
              )}
            />
            {t(tab.label)}
          </Link>
        );
      })}
    </nav>
  );
}
