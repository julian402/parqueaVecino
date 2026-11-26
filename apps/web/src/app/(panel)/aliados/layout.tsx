import type { ReactNode } from 'react';
import { PartnerShell } from '@/features/partner/components/partner-shell';

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return <PartnerShell>{children}</PartnerShell>;
}
