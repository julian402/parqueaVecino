'use client';

import { UserRole } from '@parqueavecino/contracts';
import { Button, buttonVariants } from '@parqueavecino/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession, useSignOut } from '@/features/auth/hooks/use-session';
import { routes } from '@/lib/routes';

/** Parte del encabezado que depende de la sesión. */
export function UserMenu() {
  const t = useTranslations('nav');
  const router = useRouter();
  const { user, isLoading } = useSession();
  const signOut = useSignOut();

  if (isLoading) return null;

  if (!user) {
    return (
      <Link href={routes.login} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
        {t('signIn')}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {user.role === UserRole.PARTNER && (
        <Link href={routes.partnerPanel} className="text-ink">
          {t('partnerPanel')}
        </Link>
      )}
      <span className="text-sm text-muted">{t('greeting', { name: user.fullName })}</span>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          void signOut().then(() => {
            router.push(routes.home);
          })
        }
      >
        {t('signOut')}
      </Button>
    </div>
  );
}
