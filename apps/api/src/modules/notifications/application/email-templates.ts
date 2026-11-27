import type { DocumentType } from '@parqueavecino/contracts';
import type { EmailMessage } from '../domain/mailer';

/** Nombres de los documentos en los correos (la web usa los de messages/es.json). */
export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  LIABILITY_POLICY: 'Póliza de responsabilidad civil',
  RUT: 'RUT',
  E_INVOICING: 'Resolución de facturación electrónica',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Correo sencillo: saludo, párrafos y un botón. Igual en texto plano y HTML. */
export function buildEmail(input: {
  to: string;
  subject: string;
  greetingName: string;
  paragraphs: string[];
  action?: { label: string; url: string };
}): EmailMessage {
  const greeting = `Hola, ${input.greetingName}:`;
  const text = [
    greeting,
    '',
    ...input.paragraphs.flatMap((p) => [p, '']),
    ...(input.action ? [`${input.action.label}: ${input.action.url}`, ''] : []),
    'ParqueaVecino',
  ].join('\n');
  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    ...input.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
    input.action
      ? `<p><a href="${escapeHtml(input.action.url)}">${escapeHtml(input.action.label)}</a></p>`
      : '',
    '<p>ParqueaVecino</p>',
  ].join('\n');
  return { to: input.to, subject: input.subject, text, html };
}
