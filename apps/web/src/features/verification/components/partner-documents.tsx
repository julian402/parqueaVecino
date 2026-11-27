'use client';

import {
  DOCUMENT_TYPES,
  type LotDocument,
  type PartnerLotDocuments,
} from '@parqueavecino/contracts';
import { Badge, Button, buttonVariants, Card, EmptyState, Pill, Skeleton } from '@parqueavecino/ui';
import { BadgeCheck, Building2, ExternalLink, FileText, Upload } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PageHeader } from '@/features/panel/components/panel-ui';
import {
  partnerDocumentsFile,
  usePartnerDocumentsList,
  usePartnerParkingLotsList,
} from '@/lib/api/generated/partner/partner';
import { formatCalendarDate, formatDate, formatFileSize } from '@/lib/format';
import { routes } from '@/lib/routes';
import { DOCUMENT_STATUS_TONE } from '@/lib/status';
import { openSignedFile } from '../lib/documents';
import { DocumentUploadDialog, type UploadTarget } from './document-upload-dialog';

/** Documentos de verificación por parqueadero (póliza RC, RUT, facturación) · atributo N2. */
export function PartnerDocuments() {
  const t = useTranslations('panel.partner.documents');
  const lots = usePartnerParkingLotsList();
  const [selected, setSelected] = useState<string | null>(null);
  const lotId = selected ?? lots.data?.[0]?.id ?? null;
  const lot = lots.data?.find((item) => item.id === lotId);

  const header = <PageHeader title={t('title')} subtitle={t('subtitle')} />;

  if (lots.isLoading) {
    return (
      <>
        {header}
        <Skeleton className="h-72 rounded-lg" />
      </>
    );
  }
  if (!lots.data?.length || !lotId) {
    return (
      <>
        {header}
        <EmptyState
          icon={<Building2 aria-hidden className="size-6" />}
          title={t('noLots')}
          action={
            <Link href={routes.partner.lots} className={buttonVariants({ variant: 'accent' })}>
              {t('goToLots')}
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      {header}
      {lots.data.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('lot')}>
          {lots.data.map((item) => (
            <Pill key={item.id} active={item.id === lotId} onClick={() => setSelected(item.id)}>
              {item.name}
            </Pill>
          ))}
        </div>
      )}
      {lot && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Building2 aria-hidden className="size-4" />
          <span className="font-bold text-ink">{lot.name}</span>
          {lot.verified && <BadgeCheck aria-hidden className="size-4 text-success" />}
        </p>
      )}
      <LotDocumentsList lotId={lotId} />
    </>
  );
}

function LotDocumentsList({ lotId }: { lotId: string }) {
  const t = useTranslations('panel.partner.documents');
  const { data, isLoading } = usePartnerDocumentsList(lotId);
  const [target, setTarget] = useState<UploadTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (isLoading || !data) return <Skeleton className="h-72 rounded-lg" />;

  return (
    <>
      {!data.uploadsEnabled && (
        <p role="status" className="rounded-md bg-warning/10 px-4 py-3 text-sm text-warning">
          {t('disabled')}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-md bg-success/10 px-4 py-3 text-sm text-success">
          {notice}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {DOCUMENT_TYPES.map((type) => (
          <DocumentCard
            key={type}
            type={type}
            data={data}
            document={data.documents.find((doc) => doc.type === type)}
            onUpload={() => {
              setNotice(null);
              setTarget({ parkingLotId: lotId, type });
            }}
          />
        ))}
      </div>
      <DocumentUploadDialog
        target={target}
        maxFileBytes={data.maxFileBytes}
        onClose={() => setTarget(null)}
        onUploaded={() => {
          setTarget(null);
          setNotice(t('success'));
        }}
      />
    </>
  );
}

function DocumentCard({
  type,
  data,
  document,
  onUpload,
}: {
  type: LotDocument['type'];
  data: PartnerLotDocuments;
  document: LotDocument | undefined;
  onUpload: () => void;
}) {
  const t = useTranslations('panel.partner.documents');
  const tEnums = useTranslations('enums');
  const tStatus = useTranslations('panel.documentStatus');
  const [opening, setOpening] = useState(false);

  const view = async (doc: LotDocument) => {
    setOpening(true);
    try {
      await openSignedFile(() => partnerDocumentsFile(data.parkingLotId, doc.id));
    } finally {
      setOpening(false);
    }
  };

  return (
    <Card className="flex flex-col gap-4 rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-fill">
            <FileText aria-hidden className="size-5" />
          </span>
          <h2 className="font-bold leading-tight">{tEnums(`documentType.${type}`)}</h2>
        </div>
        {document ? (
          <Badge tone={DOCUMENT_STATUS_TONE[document.status]}>{tStatus(document.status)}</Badge>
        ) : (
          <Badge tone="neutral">{t('missing')}</Badge>
        )}
      </div>
      <p className="text-sm text-muted">{t(`hint.${type}`, { days: data.expiryNoticeDays })}</p>

      {document && (
        <dl className="flex flex-col gap-1 text-sm">
          <dt className="sr-only">{t('file')}</dt>
          <dd className="truncate font-bold" title={document.fileName}>
            {document.fileName}{' '}
            <span className="font-normal text-muted">· {formatFileSize(document.sizeBytes)}</span>
          </dd>
          <dd className="text-muted">
            {t('uploadedAt', { date: formatDate(document.uploadedAt) })}
          </dd>
          {document.expiresAt && (
            <dd className={document.status === 'EXPIRED' ? 'text-danger' : 'text-muted'}>
              {t('expiresAt', { date: formatCalendarDate(document.expiresAt) })}
            </dd>
          )}
          {document.status === 'REJECTED' && document.rejectionReason && (
            <dd className="mt-1 rounded-md bg-danger/10 px-3 py-2 text-danger">
              {t('rejected', { reason: document.rejectionReason })}
            </dd>
          )}
        </dl>
      )}

      <div className="mt-auto flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={document ? 'secondary' : 'accent'}
          disabled={!data.uploadsEnabled}
          onClick={onUpload}
        >
          <Upload aria-hidden className="size-4" />
          {document ? t('replace') : t('upload')}
        </Button>
        {document && (
          <Button size="sm" variant="ghost" disabled={opening} onClick={() => void view(document)}>
            <ExternalLink aria-hidden className="size-4" />
            {t('view')}
          </Button>
        )}
      </div>
    </Card>
  );
}
