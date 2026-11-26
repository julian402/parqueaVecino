'use client';

import { Button, buttonVariants } from '@parqueavecino/ui';
import { LayoutDashboard, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession, useSignOut } from '@/features/auth/hooks/use-session';
import { panelForRole, routes } from '@/lib/routes';

const PANEL_LABEL = {
  ADMIN: 'adminPanel',
  PARTNER: 'partnerPanel',
  DRIVER: 'driverPanel',
} as const;

/** Parte del encabezado que depende de la sesión. */
export function UserMenu() {
  const t = useTranslations('nav');
  const router = useRouter();
  const { user, isLoading } = useSession();
  const signOut = useSignOut();

  if (isLoading) return <div className="h-9 w-24" aria-hidden />;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href={routes.login} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          {t('signIn')}
        </Link>
        <Link href={routes.register} className={buttonVariants({ variant: 'accent', size: 'sm' })}>
          {t('register')}
        </Link>
      </div>
    );
  }

  const initial = user.fullName.trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <Link
        href={panelForRole(user.role)}
        className={buttonVariants({ variant: 'secondary', size: 'sm' })}
      >
        <LayoutDashboard aria-hidden className="size-4" />
        <span className="hidden sm:inline">{t(PANEL_LABEL[user.role])}</span>
      </Link>
      <Link
        href={panelForRole(user.role)}
        title={t('greeting', { name: user.fullName })}
        aria-label={t(PANEL_LABEL[user.role])}
        className="flex size-9 items-center justify-center rounded-pill bg-brand font-bold text-ink transition-transform hover:scale-105"
      >
        {initial}
      </Link>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('signOut')}
        onClick={() =>
          void signOut().then(() => {
            router.push(routes.home);
          })
        }
      >
        <LogOut aria-hidden className="size-4" />
        <span className="hidden sm:inline">{t('signOut')}</span>
      </Button>
    </div>
  );
}
