'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, SELF_SIGNUP_ROLES, type RegisterInput } from '@parqueavecino/contracts';
import { Button, Card, Input, Pill } from '@parqueavecino/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { useAuthRegister } from '@/lib/api/generated/auth/auth';
import { HttpError } from '@/lib/api/http';
import { routes } from '@/lib/routes';
import { useSetSessionUser } from '../hooks/use-session';

export function RegisterForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const setUser = useSetSessionUser();
  const register = useAuthRegister();
  const form = useForm<z.input<typeof registerSchema>, unknown, RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'DRIVER' },
  });
  const role = form.watch('role');
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async (values) => {
    const user = await register.mutateAsync({ data: values });
    setUser(user);
    router.push(user.role === 'PARTNER' ? routes.partnerPanel : routes.home);
  });

  const apiError = register.error instanceof HttpError ? register.error.message : null;

  return (
    <Card className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">{t('registerTitle')}</h1>
      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)} noValidate>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs text-muted">{t('roleLabel')}</legend>
          <div className="flex flex-wrap">
            {SELF_SIGNUP_ROLES.map((value) => (
              <Pill
                key={value}
                active={role === value}
                onClick={() => form.setValue('role', value)}
              >
                {t(`roles.${value}`)}
              </Pill>
            ))}
          </div>
        </fieldset>
        <Input
          label={t('fullName')}
          autoComplete="name"
          error={errors.fullName?.message}
          {...form.register('fullName')}
        />
        <Input
          label={t('email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...form.register('email')}
        />
        <Input
          label={t('phone')}
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...form.register('phone', { setValueAs: (v: string) => v || undefined })}
        />
        <Input
          label={t('password')}
          type="password"
          autoComplete="new-password"
          placeholder={t('passwordHint')}
          error={errors.password?.message}
          {...form.register('password')}
        />
        {register.isError && (
          <p role="alert" className="text-sm text-danger">
            {apiError ?? t('genericError')}
          </p>
        )}
        <Button type="submit" size="lg" block disabled={register.isPending}>
          {t('submitRegister')}
        </Button>
      </form>
      <p className="text-sm text-muted">
        {t('hasAccount')}{' '}
        <Link href={routes.login} className="font-bold text-ink underline">
          {t('goLogin')}
        </Link>
      </p>
    </Card>
  );
}
