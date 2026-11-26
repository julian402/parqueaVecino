import { Suspense } from 'react';
import { RegisterForm } from '@/features/auth/components/register-form';

export default function RegisterPage() {
  return (
    <div className="bg-surface-muted px-4 py-12 md:py-20">
      {/* useSearchParams (?next=) requiere Suspense. */}
      <Suspense>
        <RegisterForm />
      </Suspense>
    </div>
  );
}
