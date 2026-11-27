import { Suspense } from 'react';
import { PartnerPayouts } from '@/features/partner/components/partner-payouts';

export default function PartnerPayoutsPage() {
  return (
    // useSearchParams (?onboarding= al volver de Stripe) requiere Suspense.
    <Suspense>
      <PartnerPayouts />
    </Suspense>
  );
}
