'use client';

import {
  DOCUMENT_CONTENT_TYPES,
  documentRequiresExpiry,
  type DocumentType,
} from '@parqueavecino/contracts';
import { Button, Dialog, Input } from '@parqueavecino/ui';
import { dateInTimeZone } from '@parqueavecino/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { env } from '@/env';
import { getPartnerDocumentsListQueryKey } from '@/lib/api/generated/partner/partner';
import { HttpError } from '@/lib/api/http';
import { formatFileSize } from '@/lib/format';
import { isDocumentContentType, uploadDocument } from '../lib/documents';

export interface UploadTarget {
  parkingLotId: string;
  type: DocumentType;
}

/** Subir o reemplazar un documento: archivo (PDF/JPG/PNG) y, si vence, su fecha de vencimiento. */
export function DocumentUploadDialog({
  target,
  maxFileBytes,
  onClose,
  onUploaded,
}: {
  target: UploadTarget | null;
  maxFileBytes: number;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const t = useTranslations('panel.partner.documents');
  const tCommon = useTranslations('common');
  const tEnums = useTranslations('enums');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={target !== null}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={target ? t('dialogTitle', { type: tEnums(`documentType.${target.type}`) }) : ''}
      closeLabel={tCommon('close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" form="document-upload-form" disabled={busy}>
            {busy ? t('uploading') : t('submit')}
          </Button>
        </>
      }
    >
      {/* key: el formulario empieza vacío cada vez que se abre para otro documento. */}
      {target && (
        <UploadForm
          key={`${target.parkingLotId}-${target.type}`}
          target={target}
          maxFileBytes={maxFileBytes}
          onBusy={setBusy}
          onDone={onUploaded}
        />
      )}
    </Dialog>
  );
}

function UploadForm({
  target,
  maxFileBytes,
  onBusy,
  onDone,
}: {
  target: UploadTarget;
  maxFileBytes: number;
  onBusy: (busy: boolean) => void;
  onDone: () => void;
}) {
  const t = useTranslations('panel.partner.documents');
  const queryClient = useQueryClient();
  const needsExpiry = documentRequiresExpiry(target.type);
  const today = dateInTimeZone(new Date(), env.NEXT_PUBLIC_APP_TIMEZONE);
  const maxSize = formatFileSize(maxFileBytes);

  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState('');
  const [errors, setErrors] = useState<{ file?: string; expiresAt?: string; form?: string }>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!file) next.file = t('fileRequired');
    else if (!isDocumentContentType(file.type)) next.file = t('fileType');
    else if (file.size > maxFileBytes) next.file = t('fileTooBig', { size: maxSize });
    if (needsExpiry && !expiresAt) next.expiresAt = t('expiryRequired');
    setErrors(next);
    if (Object.keys(next).length > 0 || !file || !isDocumentContentType(file.type)) return;

    onBusy(true);
    try {
      await uploadDocument({
        parkingLotId: target.parkingLotId,
        type: target.type,
        file,
        contentType: file.type,
        expiresAt: needsExpiry ? expiresAt : undefined,
      });
      await queryClient.invalidateQueries({
        queryKey: getPartnerDocumentsListQueryKey(target.parkingLotId),
      });
      onDone();
    } catch (error) {
      setErrors({ form: error instanceof HttpError ? error.message : t('uploadError') });
    } finally {
      onBusy(false);
    }
  };

  return (
    <form
      id="document-upload-form"
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4"
      noValidate
    >
      <Input
        type="file"
        label={t('file')}
        accept={DOCUMENT_CONTENT_TYPES.join(',')}
        hint={t('fileHint', { size: maxSize })}
        error={errors.file}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className="file:mr-3 file:rounded-pill file:border-0 file:bg-fill file:px-3 file:py-1 file:text-sm file:font-bold"
      />
      {needsExpiry && (
        <Input
          type="date"
          label={t('expiry')}
          min={today}
          value={expiresAt}
          hint={t('expiryHint')}
          error={errors.expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
      )}
      {errors.form && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {errors.form}
        </p>
      )}
    </form>
  );
}
