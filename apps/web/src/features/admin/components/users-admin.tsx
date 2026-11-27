'use client';

import { formatPhone, USER_ROLES, type AdminUser, type UserRole } from '@parqueavecino/contracts';
import { Badge, Button, Dialog, EmptyState, Pill, Skeleton } from '@parqueavecino/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserRoundX, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useSession } from '@/features/auth/hooks/use-session';
import {
  PageHeader,
  Pagination,
  Table,
  Td,
  Th,
  Toolbar,
} from '@/features/panel/components/panel-ui';
import {
  getAdminListUsersQueryKey,
  getAdminStatsQueryKey,
  useAdminDeleteUser,
  useAdminListUsers,
  useAdminUpdateUser,
} from '@/lib/api/generated/admin/admin';
import { HttpError } from '@/lib/api/http';
import { formatDate } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { UserFormDialog } from './user-form-dialog';

const PAGE_SIZE = 20;

const ROLE_TONE = { ADMIN: 'ink', PARTNER: 'brand', DRIVER: 'neutral' } as const;

export function UsersAdmin() {
  const t = useTranslations('panel.admin.users');
  const tRoles = useTranslations('panel.roles');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const { user: me } = useSession();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<UserRole | undefined>();
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const q = useDebouncedValue(query.trim(), 300);

  const list = useAdminListUsers({ page, pageSize: PAGE_SIZE, q: q || undefined, role });
  const update = useAdminUpdateUser();
  const remove = useAdminDeleteUser();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getAdminStatsQueryKey() });
  };

  const toggleActive = async (user: AdminUser) => {
    await update.mutateAsync({ id: user.id, data: { isActive: !user.isActive } });
    refresh();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await remove.mutateAsync({ id: deleting.id });
    setDeleting(null);
    refresh();
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden className="size-4" />
            {t('new')}
          </Button>
        }
      />

      <Toolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder={t('searchPlaceholder')}
      >
        <Pill active={!role} onClick={() => setRole(undefined)}>
          {tCommon('all')}
        </Pill>
        {USER_ROLES.map((value) => (
          <Pill
            key={value}
            active={role === value}
            onClick={() => {
              setRole(value);
              setPage(1);
            }}
          >
            {tRoles(value)}
          </Pill>
        ))}
      </Toolbar>

      {update.error instanceof HttpError && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {update.error.message}
        </p>
      )}

      {list.isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : !list.data || list.data.items.length === 0 ? (
        <EmptyState icon={<Users aria-hidden className="size-6" />} title={t('empty')} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t('columns.user')}</Th>
                <Th>{t('columns.role')}</Th>
                <Th className="hidden md:table-cell">{t('columns.phone')}</Th>
                <Th>{t('columns.status')}</Th>
                <Th className="hidden lg:table-cell">{t('columns.createdAt')}</Th>
                <Th className="text-right">{tCommon('actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((user) => {
                const isMe = user.id === me?.id;
                return (
                  <tr key={user.id} className="transition-colors hover:bg-surface-muted">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-fill font-bold">
                          {user.fullName.trim().charAt(0).toUpperCase()}
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-2 font-bold">
                            <span className="truncate">{user.fullName}</span>
                            {isMe && <Badge tone="brand">{t('you')}</Badge>}
                          </span>
                          <span className="truncate text-xs text-muted">{user.email}</span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Badge tone={ROLE_TONE[user.role]}>{tRoles(user.role)}</Badge>
                    </Td>
                    <Td className="hidden text-muted md:table-cell">
                      {user.phone ? formatPhone(user.phone) : '—'}
                    </Td>
                    <Td>
                      <Badge tone={user.isActive ? 'success' : 'danger'}>
                        {user.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </Td>
                    <Td className="hidden whitespace-nowrap text-muted lg:table-cell">
                      {formatDate(user.createdAt)}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={tCommon('edit')}
                          title={tCommon('edit')}
                          onClick={() => {
                            setEditing(user);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil aria-hidden className="size-4" />
                        </Button>
                        {!isMe && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title={user.isActive ? t('suspend') : t('activate')}
                              aria-label={user.isActive ? t('suspend') : t('activate')}
                              disabled={update.isPending}
                              onClick={() => void toggleActive(user)}
                            >
                              <UserRoundX aria-hidden className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={tCommon('delete')}
                              title={tCommon('delete')}
                              className="text-danger hover:bg-danger/10"
                              onClick={() => setDeleting(user)}
                            >
                              <Trash2 aria-hidden className="size-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}

      <UserFormDialog open={formOpen} user={editing} onClose={() => setFormOpen(false)} />

      <Dialog
        open={deleting !== null}
        onClose={() => {
          setDeleting(null);
          remove.reset();
        }}
        title={t('deleteTitle', { name: deleting?.fullName ?? '' })}
        description={t('deleteDetail')}
        closeLabel={tCommon('close')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {tCommon('cancel')}
            </Button>
            <Button
              className="border-danger bg-danger hover:bg-danger/90"
              disabled={remove.isPending}
              onClick={() => void confirmDelete()}
            >
              <Trash2 aria-hidden className="size-4" />
              {tCommon('delete')}
            </Button>
          </>
        }
      >
        {remove.error instanceof HttpError ? (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {remove.error.message}
          </p>
        ) : (
          <p className="text-sm text-muted">{deleting?.email}</p>
        )}
      </Dialog>
    </>
  );
}
