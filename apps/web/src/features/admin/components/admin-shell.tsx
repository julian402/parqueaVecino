'use client';

import { Building2, CreditCard, LayoutDashboard, Settings, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { PanelShell, type PanelNavItem } from '@/features/panel/components/panel-shell';
import { routes } from '@/lib/routes';

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations('panel.admin.nav');
  const nav: PanelNavItem[] = [
    { href: routes.admin.overview, label: t('overview'), Icon: LayoutDashboard },
    { href: routes.admin.users, label: t('users'), Icon: Users },
    { href: routes.admin.lots, label: t('lots'), Icon: Building2 },
    { href: routes.admin.payments, label: t('payments'), Icon: CreditCard },
    { href: routes.admin.settings, label: t('settings'), Icon: Settings },
  ];
  return (
    <PanelShell role="ADMIN" nav={nav}>
      {children}
    </PanelShell>
  );
}
