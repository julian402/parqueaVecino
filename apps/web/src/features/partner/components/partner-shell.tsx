'use client';

import { Building2, FileCheck2, LayoutDashboard, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { PanelShell, type PanelNavItem } from '@/features/panel/components/panel-shell';
import { routes } from '@/lib/routes';

export function PartnerShell({ children }: { children: ReactNode }) {
  const t = useTranslations('panel.partner.nav');
  const nav: PanelNavItem[] = [
    { href: routes.partner.overview, label: t('overview'), Icon: LayoutDashboard },
    { href: routes.partner.lots, label: t('lots'), Icon: Building2 },
    { href: routes.partner.documents, label: t('documents'), Icon: FileCheck2 },
    { href: routes.partner.payouts, label: t('payouts'), Icon: Wallet },
  ];
  return (
    <PanelShell role="PARTNER" nav={nav}>
      {children}
    </PanelShell>
  );
}
