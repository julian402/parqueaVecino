'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  adminUserCreateSchema,
  adminUserUpdateSchema,
  USER_ROLES,
  type AdminUser,
  type AdminUserCreateInput,
  type AdminUserUpdateInput,
} from '@parqueavecino/contracts';
import { Button, Dialog, Input, Select } from '@parqueavecino/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import {
  getAdminListUsersQueryKey,
  getAdminStatsQueryKey,
  useAdminCreateUser,
  useAdminUpdateUser,
} from '@/lib/api/generated/admin/admin';
import { HttpError } from '@/lib/api/http';

/** Campos opcionales vacíos → sin valor (el esquema de contracts no acepta strings vacíos). */
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

function CreateForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations('panel.admin.users.form');
  const tRoles = useTranslations('panel.roles');
  const create = useAdminCreateUser();
  const form = useForm<z.input<typeof adminUserCreateSchema>, unknown, AdminUserCreateInput>({
    resolver: zodResolver(adminUserCreateSchema),
    defaultValues: { role: 'DRIVER' },
  });
  const submit = form.handleSubmit(async (data) => {
    await create.mutateAsync({ data });
    onDone();
  });
  const errors = form.formState.errors;
  return (
    <form
      id="user-form"
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <Input
        label={t('fullName')}
        error={errors.fullName?.message}
        {...form.register('fullName')}
      />
      <Input
        label={t('email')}
        type="email"
        autoComplete="off"
        error={errors.email?.message}
        {...form.register('email')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t('role')} {...form.register('role')}>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {tRoles(role)}
            </option>
          ))}
        </Select>
        <Input
          label={t('phone')}
          inputMode="tel"
          error={errors.phone?.message}
          {...form.register('phone', { setValueAs: emptyToUndefined })}
        />
      </div>
      <Input
        label={t('password')}
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...form.register('password')}
      />
      <MutationError error={create.error} />
    </form>
  );
}

function EditForm({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const t = useTranslations('panel.admin.users.form');
  const tRoles = useTranslations('panel.roles');
  const update = useAdminUpdateUser();
  const form = useForm<z.input<typeof adminUserUpdateSchema>, unknown, AdminUserUpdateInput>({
    resolver: zodResolver(adminUserUpdateSchema),
    defaultValues: {
      fullName: user.fullName,
      phone: user.phone ?? undefined,
      role: user.role,
      isActive: user.isActive,
    },
  });
  const submit = form.handleSubmit(async (data) => {
    await update.mutateAsync({ id: user.id, data });
    onDone();
  });
  const errors = form.formState.errors;
  return (
    <form
      id="user-form"
      onSubmit={(e) => void submit(e)}
      className="flex flex-col gap-4"
      noValidate
    >
      <Input label={t('email')} value={user.email} disabled readOnly />
      <Input
        label={t('fullName')}
        error={errors.fullName?.message}
        {...form.register('fullName')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t('role')} {...form.register('role')}>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {tRoles(role)}
            </option>
          ))}
        </Select>
        <Input
          label={t('phone')}
          inputMode="tel"
          error={errors.phone?.message}
          {...form.register('phone', { setValueAs: (v: unknown) => (v === '' ? null : v) })}
        />
      </div>
      <Input
        label={t('newPassword')}
        type="password"
        autoComplete="new-password"
        error={errors.password?.message ?? undefined}
        {...form.register('password', { setValueAs: emptyToUndefined })}
      />
      <p className="-mt-2 text-xs text-muted">{t('passwordHint')}</p>
      <label className="flex items-center gap-3 text-sm font-bold">
        <input type="checkbox" className="size-5 accent-ink" {...form.register('isActive')} />
        {t('isActive')}
      </label>
      <MutationError error={update.error} />
    </form>
  );
}

function MutationError({ error }: { error: unknown }) {
  const t = useTranslations('common');
  if (!error) return null;
  return (
    <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
      {error instanceof HttpError ? error.message : t('error')}
    </p>
  );
}

/** Crear (sin `user`) o editar un usuario. */
export function UserFormDialog({
  open,
  user,
  onClose,
}: {
  open: boolean;
  user: AdminUser | null;
  onClose: () => void;
}) {
  const t = useTranslations('panel.admin.users.form');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const done = () => {
    void queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getAdminStatsQueryKey() });
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={user ? t('editTitle') : t('createTitle')}
      closeLabel={tCommon('close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" form="user-form">
            {user ? tCommon('save') : tCommon('create')}
          </Button>
        </>
      }
    >
      {user ? <EditForm key={user.id} user={user} onDone={done} /> : <CreateForm onDone={done} />}
    </Dialog>
  );
}
