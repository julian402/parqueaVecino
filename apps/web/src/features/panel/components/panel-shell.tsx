'use client';

import type { UserRole } from '@parqueavecino/contracts';
import { buttonVariants, cn, Skeleton } from '@parqueavecino/ui';
import { ArrowLeft, LogOut, Menu, ShieldAlert, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { useSession, useSignOut } from '@/features/auth/hooks/use-session';
import { routes } from '@/lib/routes';

export interface PanelNavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

type PanelRole = UserRole;

/** Activo si es la ruta exacta o una subruta (salvo la raíz del panel, que solo es exacta). */
function isActive(pathname: string, href: string, rootHref: string): boolean {
  return href === rootHref ? pathname === href : pathname.startsWith(href);
}

/**
 * Marco de los paneles (admin, aliados y conductor): barra lateral fija en escritorio y cajón en celular.
 * Exige sesión con el rol del panel; la API igual valida cada petición (esto es solo UX).
 */
export function PanelShell({
  role,
  nav,
  children,
}: {
  role: PanelRole;
  nav: PanelNavItem[];
  children: ReactNode;
}) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useSession();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const rootHref = nav[0]?.href ?? routes.home;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`${routes.login}?next=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, user, pathname, router]);

  // Cierra el cajón al navegar.
  useEffect(() => setOpen(false), [pathname]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen">
        <div className="hidden w-64 bg-ink lg:block" />
        <div className="flex flex-1 flex-col gap-4 p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (user.role !== role) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-muted px-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-pill bg-danger/10 text-danger">
          <ShieldAlert aria-hidden className="size-7" />
        </span>
        <p className="font-bold">{t('common.restricted')}</p>
        <Link href={routes.home} className={buttonVariants()}>
          {t('common.goHome')}
        </Link>
      </div>
    );
  }

  const initial = user.fullName.trim().charAt(0).toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col gap-6 bg-ink px-4 py-5 text-ink-contrast">
      <div className="flex items-center justify-between gap-2 px-2">
        <Link href={rootHref} className="flex items-center gap-2">
          <span className="rounded-pill bg-brand px-3 py-1 text-sm font-bold tracking-wider text-ink uppercase">
            {t(`panel.brandSuffix.${role}`)}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t('common.closeMenu')}
          className="rounded-pill p-1.5 text-soft hover:bg-ink-contrast/10 hover:text-ink-contrast lg:hidden"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {nav.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href, rootHref);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold transition-colors',
                active
                  ? 'bg-brand text-ink shadow-lg shadow-brand/20'
                  : 'text-soft hover:bg-ink-contrast/10 hover:text-ink-contrast',
              )}
            >
              <Icon aria-hidden className="size-5 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-ink-contrast/10 pt-4">
        <Link
          href={routes.home}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-soft transition-colors hover:bg-ink-contrast/10 hover:text-ink-contrast"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t('common.backToSite')}
        </Link>
        <div className="mt-2 flex items-center gap-3 rounded-md bg-ink-contrast/5 p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-brand font-bold text-ink">
            {initial}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-bold">{user.fullName}</span>
            <span className="truncate text-xs text-soft">{t(`panel.roles.${user.role}`)}</span>
          </div>
          <button
            type="button"
            aria-label={t('common.signOut')}
            title={t('common.signOut')}
            onClick={() => void signOut().then(() => router.push(routes.home))}
            className="rounded-pill p-2 text-soft transition-colors hover:bg-ink-contrast/10 hover:text-ink-contrast"
          >
            <LogOut aria-hidden className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-muted">
      {/* Escritorio: barra lateral fija. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block print:hidden">
        {sidebar}
      </aside>

      {/* Celular: cajón deslizable. */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] transition-transform lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!open}
      >
        {sidebar}
      </aside>

      {/* Al imprimir (p. ej. el recibo) solo sale el contenido. */}
      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden print:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('common.openMenu')}
            className="rounded-pill p-2 hover:bg-fill"
          >
            <Menu aria-hidden className="size-5" />
          </button>
          <span className="rounded-pill bg-brand px-3 py-1 text-sm font-bold tracking-wider text-ink uppercase">
            {t(`panel.brandSuffix.${role}`)}
          </span>
        </header>
        <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
