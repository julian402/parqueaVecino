'use client';

import type { PayoutAccountStatus } from '@parqueavecino/contracts';
import { Badge, Button, Skeleton } from '@parqueavecino/ui';
import { ArrowUpRight, CircleCheck, Info, Landmark } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { PageHeader, Panel } from '@/features/panel/components/panel-ui';
import {
  usePartnerPayoutsDashboard,
  usePartnerPayoutsGet,
  usePartnerPayoutsOnboarding,
} from '@/lib/api/generated/partner/partner';
import { HttpError } from '@/lib/api/http';

type Status = PayoutAccountStatus | 'NONE';

const STATUS_TONE = {
  NONE: 'neutral',
  PENDING: 'warning',
  ACTION_REQUIRED: 'danger',
  ACTIVE: 'success',
} as const satisfies Record<Status, string>;

const HOW_STEPS = ['connect', 'pay', 'split', 'refund'] as const;

/**
 * Pagos del aliado (Stripe Connect): conecta su cuenta y desde ahí recibe cada mensualidad
 * menos la comisión. Stripe aloja el onboarding y el panel de la cuenta.
 */
export function PartnerPayouts() {
  const t = useTranslations('panel.partner.payouts');
  const onboardingParam = useSearchParams().get('onboarding');
  const account = usePartnerPayoutsGet({ query: { refetchOnWindowFocus: true } });
  const onboarding = usePartnerPayoutsOnboarding();
  const dashboard = usePartnerPayoutsDashboard();
  const autoRefreshed = useRef(false);

  const openOnboarding = async () => {
    const { url } = await onboarding.mutateAsync();
    window.location.assign(url);
  };

  // El enlace de Stripe venció o ya se usó: se pide uno nuevo y se continúa.
  useEffect(() => {
    if (onboardingParam !== 'refresh' || autoRefreshed.current) return;
    autoRefreshed.current = true;
    void openOnboarding();
    // Solo al llegar desde Stripe con ?onboarding=refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingParam]);

  const openDashboard = async () => {
    const { url } = await dashboard.mutateAsync();
    window.open(url, '_blank', 'noopener');
  };

  const error = onboarding.error ?? dashboard.error;
  const status: Status = account.data?.status ?? 'NONE';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {account.isLoading ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : account.data && !account.data.paymentsEnabled ? (
        <Panel>
          <p className="text-muted">{t('disabled')}</p>
        </Panel>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <Panel
            title={t('accountTitle')}
            action={<Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>}
          >
            {onboardingParam === 'return' && (
              <p className="flex gap-2 rounded-md bg-surface-muted p-3 text-sm">
                <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />
                {t('returned')}
              </p>
            )}
            <div className="flex gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-surface-muted">
                <Landmark aria-hidden className="size-5" />
              </span>
              <p className="text-sm">{t(`detail.${status}`)}</p>
            </div>
            {status !== 'ACTIVE' && (
              <p className="flex gap-2 rounded-md bg-cream p-3 text-sm">
                <Info aria-hidden className="size-4 shrink-0 text-brand-text" />
                {t('testMode')}
              </p>
            )}
            {error instanceof Error && (
              <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                {error instanceof HttpError ? error.message : t('error')}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              {status !== 'ACTIVE' && (
                <Button
                  variant="accent"
                  size="lg"
                  disabled={onboarding.isPending}
                  onClick={() => void openOnboarding()}
                >
                  {status === 'NONE' ? t('connect') : t('continue')}
                  <ArrowUpRight aria-hidden className="size-4" />
                </Button>
              )}
              {status !== 'NONE' && (
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={dashboard.isPending}
                  onClick={() => void openDashboard()}
                >
                  {t('dashboard')}
                  <ArrowUpRight aria-hidden className="size-4" />
                </Button>
              )}
            </div>
          </Panel>

          <Panel title={t('howTitle')}>
            <ol className="flex flex-col gap-3 text-sm">
              {HOW_STEPS.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-brand text-xs font-bold">
                    {index + 1}
                  </span>
                  {t(`how.${step}`)}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      )}
    </div>
  );
}
