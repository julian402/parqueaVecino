'use client';

import { Button, Card, cn, Input } from '@parqueavecino/ui';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';

/** Encabezado de cada pantalla del panel: título, subtítulo y acciones. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Tarjeta de sección con título opcional. */
export function Panel({
  title,
  action,
  className,
  children,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn('flex flex-col gap-4 rounded-lg p-5', className)}>
      {(title ?? action) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

/** Barra de filtros con búsqueda de texto. */
export function Toolbar({
  query,
  onQuery,
  placeholder,
  children,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative md:max-w-sm md:flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="py-2.5 pl-10"
        />
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'border-b border-line bg-surface-muted px-4 py-3 text-left text-xs font-bold tracking-wide whitespace-nowrap text-muted uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-line px-4 py-3 align-middle', className)} {...props} />;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const t = useTranslations('common');
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted">
      <span>{t('results', { count: total })}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label={t('previous')}
        >
          <ChevronLeft aria-hidden className="size-4" />
        </Button>
        <span className="whitespace-nowrap">{t('pageOf', { page, pages })}</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label={t('next')}
        >
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Barra horizontal de distribución (p. ej. usuarios por rol). */
export function BreakdownList({
  items,
  total,
}: {
  items: { key: string; label: string; value: number; className: string }[];
  total: number;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const percent = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <li key={item.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">{item.label}</span>
              <span className="font-bold">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-pill bg-fill">
              <div
                className={cn('h-full rounded-pill transition-all', item.className)}
                style={{ width: `${percent}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
