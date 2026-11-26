'use client';

import { Button, Card, Input, Skeleton } from '@parqueavecino/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/features/panel/components/panel-ui';
import {
  getAdminListSettingsQueryKey,
  useAdminListSettings,
  useAdminUpdateSetting,
} from '@/lib/api/generated/admin/admin';
import type { AdminListSettings200Item } from '@/lib/api/generated/model';
import { HttpError } from '@/lib/api/http';
import { formatDateTime } from '@/lib/format';

/** Serializa el valor para editarlo: número tal cual, objetos como JSON legible. */
function toDraft(value: unknown): string {
  return typeof value === 'number' ? String(value) : JSON.stringify(value, null, 2);
}

function SettingCard({ setting }: { setting: AdminListSettings200Item }) {
  const t = useTranslations('panel.admin.settings');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const update = useAdminUpdateSetting();
  const isNumber = typeof setting.value === 'number';
  const [draft, setDraft] = useState(() => toDraft(setting.value));
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = draft !== toDraft(setting.value);

  const save = async () => {
    setLocalError(null);
    setSaved(false);
    let value: unknown;
    try {
      value = isNumber ? Number(draft) : JSON.parse(draft);
    } catch {
      setLocalError(t('invalidJson'));
      return;
    }
    await update.mutateAsync({ key: setting.key, data: { value } });
    setSaved(true);
    void queryClient.invalidateQueries({ queryKey: getAdminListSettingsQueryKey() });
  };

  const apiError = update.error instanceof HttpError ? update.error : null;
  const issues = (apiError?.body?.details as { issues?: { path: string; message: string }[] })
    ?.issues;
  const error =
    localError ??
    (apiError
      ? [apiError.message, ...(issues ?? []).map((i) => `${i.path}: ${i.message}`)].join(' · ')
      : null);

  // Etiqueta legible (next-intl no admite "." en claves: se usa "_"). Sin traducción, la descripción.
  const messageKey = `keys.${setting.key.replaceAll('.', '_')}`;
  const label = t.has(messageKey) ? t(messageKey) : setting.description;

  return (
    <Card className="flex flex-col gap-4 rounded-lg p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-bold">{label}</h2>
        <p className="text-sm text-muted">{setting.description}</p>
        <code className="w-fit rounded-sm bg-fill px-1.5 py-0.5 text-xs text-muted">
          {setting.key}
        </code>
      </div>
      {isNumber ? (
        <Input
          type="number"
          value={draft}
          aria-label={label}
          onChange={(event) => setDraft(event.target.value)}
        />
      ) : (
        <textarea
          value={draft}
          aria-label={label}
          spellCheck={false}
          rows={Math.min(12, draft.split('\n').length + 1)}
          onChange={(event) => setDraft(event.target.value)}
          className="rounded-md border-2 border-line bg-surface-muted px-4 py-3 font-mono text-xs text-ink focus:border-brand focus:ring-4 focus:ring-brand/25 focus:outline-none"
        />
      )}
      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted">
          {saved ? (
            <span className="inline-flex items-center gap-1 font-bold text-success">
              <Check aria-hidden className="size-4" />
              {t('saved')}
            </span>
          ) : (
            t('updatedAt', { date: formatDateTime(setting.updatedAt) })
          )}
        </span>
        <Button size="sm" disabled={!dirty || update.isPending} onClick={() => void save()}>
          {update.isPending ? tCommon('saving') : tCommon('save')}
        </Button>
      </div>
    </Card>
  );
}

export function SettingsAdmin() {
  const t = useTranslations('panel.admin.settings');
  const { data, isLoading } = useAdminListSettings();
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {isLoading || !data ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {data.map((setting) => (
            <SettingCard key={`${setting.key}-${setting.updatedAt}`} setting={setting} />
          ))}
        </div>
      )}
    </>
  );
}
