'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Texto accesible del botón de cerrar (viene de los mensajes de la app). */
  closeLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Modal sobre `<dialog>` nativo: foco atrapado, Escape y fondo los maneja el navegador.
 * En celular se ancla abajo como hoja; en escritorio queda centrado.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  children,
  footer,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'm-auto mb-0 w-full max-w-lg rounded-t-xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-sm sm:mb-auto sm:rounded-xl',
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold">{title}</h2>
              {description && <p className="text-sm text-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="rounded-pill p-1.5 text-muted transition-colors hover:bg-fill hover:text-ink"
            >
              <X aria-hidden className="size-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <footer className="flex justify-end gap-2 border-t border-line bg-surface-muted px-6 py-4">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
