'use client';

import {
  DOCUMENT_STATUSES,
  type AdminDocument,
  type AdminDocumentReviewInput,
  type DocumentStatus,
} from '@parqueavecino/contracts';
import { Badge, Button, Dialog, EmptyState, Input, Pill, Skeleton } from '@parqueavecino/ui';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileCheck2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import {
  PageHeader,
  Pagination,
  Table,
  Td,
  Th,
  Toolbar,
} from '@/features/panel/components/panel-ui';
import {
  adminDocumentsFile,
  getAdminDocumentsListQueryKey,
  useAdminDocumentsList,
  useAdminDocumentsReview,
} from '@/lib/api/generated/admin/admin';
import { HttpError } from '@/lib/api/http';
import { formatCalendarDate, formatDate, formatFileSize } from '@/lib/format';
import { DOCUMENT_STATUS_TONE } from '@/lib/status';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { openSignedFile } from '../lib/documents';

const PAGE_SIZE = 20;

/** Cola de revisión de documentos de los aliados (empieza en "En revisión"). */
export function DocumentsAdmin() {
  const t = useTranslations('panel.admin.documents');
  const tStatus = useTranslations('panel.documentStatus');
  const tEnums = useTranslations('enums');
  const tCommon = useTranslations('common');
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DocumentStatus | undefined>('PENDING_REVIEW');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<AdminDocument | null>(null);
  const q = useDebouncedValue(query.trim(), 300);

  const list = useAdminDocumentsList({ page, pageSize: PAGE_SIZE, q: q || undefined, status });
  const review = useAdminDocumentsReview();

  const act = async (doc: AdminDocument, input: AdminDocumentReviewInput) => {
    await review.mutateAsync({ id: doc.id, data: input });
    void queryClient.invalidateQueries({ queryKey: getAdminDocumentsListQueryKey() });
  };

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Toolbar
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder={t('searchPlaceholder')}
      >
        <Pill
          active={!status}
          onClick={() => {
            setStatus(undefined);
            setPage(1);
          }}
        >
          {tCommon('all')}
        </Pill>
        {DOCUMENT_STATUSES.map((value) => (
          <Pill
            key={value}
            active={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {tStatus(value)}
          </Pill>
        ))}
      </Toolbar>

      {review.error instanceof HttpError && (
        <p role="alert" className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {review.error.message}
        </p>
      )}

      {list.isLoading ? (
        <Skeleton className="h-96 rounded-lg" />
      ) : !list.data || list.data.items.length === 0 ? (
        <EmptyState icon={<FileCheck2 aria-hidden className="size-6" />} title={t('empty')} />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>{t('columns.document')}</Th>
                <Th className="hidden md:table-cell">{t('columns.lot')}</Th>
                <Th className="hidden lg:table-cell">{t('columns.expires')}</Th>
                <Th>{t('columns.status')}</Th>
                <Th className="text-right">{tCommon('actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((doc) => (
                <tr key={doc.id} className="transition-colors hover:bg-surface-muted">
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-bold">{tEnums(`documentType.${doc.type}`)}</span>
                      <span className="text-xs text-muted">
                        {doc.fileName} · {formatFileSize(doc.sizeBytes)}
                      </span>
                      <span className="text-xs text-muted">
                        {t('uploadedAt', { date: formatDate(doc.uploadedAt) })}
                      </span>
                      {/* En celular el parqueadero va aquí (su columna se oculta). */}
                      <span className="text-xs text-muted md:hidden">{doc.parkingLot.name}</span>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <div className="flex flex-col">
                      <span>{doc.parkingLot.name}</span>
                      <span className="text-xs text-muted">
                        {doc.partner.fullName} · {doc.partner.email}
                      </span>
                    </div>
                  </Td>
                  <Td className="hidden whitespace-nowrap text-muted lg:table-cell">
                    {doc.expiresAt ? formatCalendarDate(doc.expiresAt) : t('noExpiry')}
                  </Td>
                  <Td>
                    <Badge tone={DOCUMENT_STATUS_TONE[doc.status]}>{tStatus(doc.status)}</Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-1">
                      {doc.status !== 'EXPIRED' && doc.status !== 'APPROVED' && (
                        <Button
                          size="sm"
                          variant="accent"
                          disabled={review.isPending}
                          onClick={() => void act(doc, { status: 'APPROVED' })}
                        >
                          {t('approve')}
                        </Button>
                      )}
                      {doc.status !== 'EXPIRED' && doc.status !== 'REJECTED' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={review.isPending}
                          onClick={() => setRejecting(doc)}
                        >
                          {t('reject')}
                        </Button>
                      )}
                      <button
                        type="button"
                        aria-label={t('view')}
                        title={t('view')}
                        onClick={() => void openSignedFile(() => adminDocumentsFile(doc.id))}
                        className="rounded-pill p-2 text-muted hover:bg-fill hover:text-ink"
                      >
                        <ExternalLink aria-hidden className="size-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={list.data.total} onPage={setPage} />
        </>
      )}

      <RejectDialog
        document={rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          if (!rejecting) return;
          await act(rejecting, { status: 'REJECTED', rejectionReason: reason });
          setRejecting(null);
        }}
      />
    </>
  );
}

/** Motivo del rechazo: lo ve el aliado en su panel y en el correo. */
function RejectDialog({
  document,
  onClose,
  onConfirm,
}: {
  document: AdminDocument | null;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const t = useTranslations('panel.admin.documents');
  const tEnums = useTranslations('enums');
  const tCommon = useTranslations('common');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason('');
    } catch (failure) {
      setError(failure instanceof HttpError ? failure.message : tCommon('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={document !== null}
      onClose={onClose}
      title={t('rejectTitle')}
      description={
        document
          ? `${tEnums(`documentType.${document.type}`)} · ${document.parkingLot.name}`
          : undefined
      }
      closeLabel={tCommon('close')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" form="reject-document-form" disabled={busy}>
            {t('rejectConfirm')}
          </Button>
        </>
      }
    >
      <form
        id="reject-document-form"
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-3"
        noValidate
      >
        <Input
          label={t('rejectReason')}
          hint={t('rejectHint')}
          value={reason}
          maxLength={300}
          onChange={(event) => setReason(event.target.value)}
          error={error ?? undefined}
        />
      </form>
    </Dialog>
  );
}
