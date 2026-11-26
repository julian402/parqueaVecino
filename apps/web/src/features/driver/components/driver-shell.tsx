'use client';

import { CalendarCheck, History, LayoutDashboard, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { PanelShell, type PanelNavItem } from '@/features/panel/components/panel-shell';
import { routes } from '@/lib/routes';

export function DriverShell({ children }: { children: ReactNode }) {
  const t = useTranslations('panel.driver.nav');
  const nav: PanelNavItem[] = [
    { href: routes.driver.overview, label: t('overview'), Icon: LayoutDashboard },
    { href: routes.myBookings, label: t('bookings'), Icon: CalendarCheck },
    { href: routes.driver.history, label: t('history'), Icon: History },
    { href: routes.profile, label: t('profile'), Icon: UserRound },
  ];
  return (
    <PanelShell role="DRIVER" nav={nav}>
      {children}
    </PanelShell>
  );
}
