'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@parqueavecino/contracts';
import { Button, Card, Input } from '@parqueavecino/ui';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useAuthLogin } from '@/lib/api/generated/auth/auth';
import { HttpError } from '@/lib/api/http';
import { homeForRole, routes, safeNext } from '@/lib/routes';
import { useSetSessionUser } from '../hooks/use-session';

export function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const setUser = useSetSessionUser();
  const login = useAuthLogin();
  const form = useForm<z.input<typeof loginSchema>, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const user = await login.mutateAsync({ data: values });
    setUser(user);
    // Vuelve a donde estaba (p. ej. reservar) o al inicio de su rol (panel admin/aliado).
    router.push(next ?? homeForRole(user.role));
  });

  const apiError = login.error instanceof HttpError ? login.error.message : null;

  return (
    <Card className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">{t('loginTitle')}</h1>
      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <Input
          label={t('email')}
          type="email"
          autoComplete="email"
          error={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Input
          label={t('password')}
          type="password"
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          {...form.register('password')}
        />
        {login.isError && (
          <p role="alert" className="text-sm text-danger">
            {apiError ?? t('genericError')}
          </p>
        )}
        <Button type="submit" size="lg" block disabled={login.isPending}>
          {t('submitLogin')}
        </Button>
      </form>
      <p className="text-sm text-muted">
        {t('noAccount')}{' '}
        <Link
          href={next ? `${routes.register}?next=${encodeURIComponent(next)}` : routes.register}
          className="font-bold text-ink underline"
        >
          {t('goRegister')}
        </Link>
      </p>
    </Card>
  );
}
