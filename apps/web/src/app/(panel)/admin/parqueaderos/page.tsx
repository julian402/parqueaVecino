import { Suspense } from 'react';
import { LotsAdmin } from '@/features/admin/components/lots-admin';

export default function AdminLotsPage() {
  // useSearchParams (?status=) requiere Suspense.
  return (
    <Suspense>
      <LotsAdmin />
    </Suspense>
  );
}
