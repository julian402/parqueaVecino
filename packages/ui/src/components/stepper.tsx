import { cn } from '../lib/cn';

/** Pasos del checkout: "1. Datos — 2. Pago — 3. Listo". */
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((step, index) => (
        <li
          key={step}
          aria-current={index === current ? 'step' : undefined}
          className={cn(
            'flex items-center gap-2',
            index === current ? 'font-bold text-ink' : 'text-muted',
          )}
        >
          {index > 0 && <span aria-hidden>—</span>}
          {index + 1}. {step}
        </li>
      ))}
    </ol>
  );
}
