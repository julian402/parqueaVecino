'use client';

import { cn } from '@parqueavecino/ui';
import { CalendarCheck, Search, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { routes } from '@/lib/routes';

const tabs = [
  { href: routes.home, label: 'search', Icon: Search },
  { href: routes.myBookings, label: 'myBookings', Icon: CalendarCheck },
  { href: routes.profile, label: 'profile', Icon: UserRound },
] as const;

/** Barra inferior en celular (mockups 375 px). En escritorio se oculta. */
export function MobileTabBar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-line bg-surface/95 backdrop-blur md:hidden">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 text-xs',
              active ? 'font-bold text-ink' : 'text-muted',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-12 items-center justify-center rounded-pill transition-colors',
                active && 'bg-brand',
              )}
            >
              <Icon aria-hidden className="size-5" />
            </span>
            {t(label)}
          </Link>
        );
      })}
    </nav>
  );
}
