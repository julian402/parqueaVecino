import { Suspense } from 'react';
import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage() {
  return (
    <div className="bg-surface-muted px-4 py-12 md:py-20">
      {/* useSearchParams (?next=) requiere Suspense. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
