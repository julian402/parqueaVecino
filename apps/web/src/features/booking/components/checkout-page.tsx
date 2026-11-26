'use client';

import { Badge, Button, buttonVariants, Card, Skeleton, Stepper } from '@parqueavecino/ui';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Appearance } from '@stripe/stripe-js';
import { useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleX, Info, Lock, MapPin, SearchX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type FormEvent } from 'react';
import { env } from '@/env';
import {
  getBookingsCheckoutQueryKey,
  getBookingsListQueryKey,
  useBookingsCancel,
  useBookingsCheckout,
} from '@/lib/api/generated/bookings/bookings';
import type { BookingsCheckout200Booking } from '@/lib/api/generated/model';
import { HttpError } from '@/lib/api/http';
import { formatDate, formatPrice } from '@/lib/format';
import { SHIFT_ICONS, VEHICLE_ICONS } from '@/lib/icons';
import { routes } from '@/lib/routes';

const stripePromise = env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
  : null;

/** Colores del Payment Element tomados de los tokens CSS (nada de hex en el componente). */
function stripeAppearance(): Appearance {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(`--color-${name}`).trim();
  return {
    theme: 'stripe',
    variables: {
      colorPrimary: token('ink'),
      colorText: token('ink'),
      colorDanger: token('danger'),
      colorBackground: token('surface'),
      borderRadius: css.getPropertyValue('--radius-md').trim(),
      fontFamily: css.getPropertyValue('--font-sans').trim(),
    },
  };
}

function Summary({ booking }: { booking: BookingsCheckout200Booking }) {
  const t = useTranslations('checkout');
  const tEnums = useTranslations('enums');
  const ShiftIcon = SHIFT_ICONS[booking.shift];
  const VehicleIcon = VEHICLE_ICONS[booking.vehicleType];
  return (
    <Card className="flex flex-col gap-4 rounded-lg p-5">
      <h2 className="font-bold">{t('summary')}</h2>
      <div className="flex flex-col gap-1">
        <span className="text-lg font-bold">{booking.parkingLot.name}</span>
        <span className="inline-flex items-center gap-1 text-sm text-muted">
          <MapPin aria-hidden className="size-4" />
          {booking.parkingLot.address}
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
          <dt className="text-xs text-muted">{t('shift')}</dt>
          <dd className="inline-flex items-center gap-1.5 font-bold">
            <ShiftIcon aria-hidden className="size-4" />
            {tEnums(`shift.${booking.shift}`)}
          </dd>
        </div>
        <div className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
          <dt className="text-xs text-muted">{t('plate')}</dt>
          <dd className="inline-flex items-center gap-1.5 font-bold tracking-widest">
            <VehicleIcon aria-hidden className="size-4" />
            {booking.plate}
          </dd>
        </div>
      </dl>
      <div className="flex items-end justify-between border-t border-line pt-4">
        <span className="text-sm text-muted">{t('total')}</span>
        <span className="flex flex-col items-end">
          <span className="text-2xl font-bold">
            {formatPrice(booking.priceMinor, booking.currency)}
          </span>
          <span className="text-xs text-muted">{t('perMonth')}</span>
        </span>
      </div>
    </Card>
  );
}

function PaymentForm({
  booking,
  onPaid,
}: {
  booking: BookingsCheckout200Booking;
  onPaid: () => void;
}) {
  const t = useTranslations('checkout');
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const pay = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    setError(null);
    // Tarjetas sin 3-D Secure no redirigen; las que sí vuelven a esta misma URL.
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });
    setPaying(false);
    if (result.error) {
      setError(result.error.message ?? null);
      return;
    }
    onPaid();
  };

  return (
    <form onSubmit={(event) => void pay(event)} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="accent" size="lg" block disabled={!stripe || paying}>
        <Lock aria-hidden className="size-4" />
        {paying
          ? t('paying')
          : t('pay', { amount: formatPrice(booking.priceMinor, booking.currency) })}
      </Button>
    </form>
  );
}

function Success({ booking }: { booking: BookingsCheckout200Booking }) {
  const t = useTranslations('checkout');
  const tReceipt = useTranslations('bookings');
  return (
    <Card className="flex flex-col items-center gap-5 rounded-xl p-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-pill bg-success/10 text-success">
        <CircleCheck aria-hidden className="size-9" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{t('successTitle')}</h1>
        <p className="text-muted">{t('successDetail')}</p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-1 rounded-lg bg-ink p-5 text-ink-contrast">
        <span className="text-xs font-bold tracking-widest text-brand uppercase">
          {t('accessCode')}
        </span>
        <span className="font-mono text-3xl font-bold tracking-widest">{booking.accessCode}</span>
      </div>
      {booking.startsAt && booking.endsAt && (
        <p className="text-sm">
          <span className="text-muted">{t('validity')}: </span>
          <span className="font-bold">
            {t('validFromTo', {
              start: formatDate(booking.startsAt),
              end: formatDate(booking.endsAt),
            })}
          </span>
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href={routes.driver.receipt(booking.id)}
          className={buttonVariants({ variant: 'secondary', size: 'lg' })}
        >
          {tReceipt('receipt')}
        </Link>
        <Link href={routes.myBookings} className={buttonVariants({ size: 'lg' })}>
          {t('goToBookings')}
        </Link>
      </div>
    </Card>
  );
}

/** Checkout en 3 pasos (mockups 4 y 5): Datos → Pago → Listo. */
export function CheckoutPage({ id }: { id: string }) {
  const t = useTranslations('checkout');
  const router = useRouter();
  const queryClient = useQueryClient();
  const checkout = useBookingsCheckout(id, { query: { retry: false } });
  const cancel = useBookingsCancel();
  const appearance = useMemo(
    () => (typeof window === 'undefined' ? undefined : stripeAppearance()),
    [],
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getBookingsCheckoutQueryKey(id) });
    void queryClient.invalidateQueries({ queryKey: getBookingsListQueryKey() });
  };

  if (checkout.isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-[1fr_22rem]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!checkout.data) {
    const unauthorized = checkout.error instanceof HttpError && checkout.error.status === 401;
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <SearchX aria-hidden className="size-10 text-muted" />
        <p className="font-bold">{t('notFound')}</p>
        <Link
          href={unauthorized ? `${routes.login}?next=${routes.checkout(id)}` : routes.search}
          className={buttonVariants()}
        >
          {t('backToSearch')}
        </Link>
      </div>
    );
  }

  const { booking, clientSecret } = checkout.data;
  const step = booking.status === 'ACTIVE' ? 2 : 1;
  const steps = [t('steps.details'), t('steps.payment'), t('steps.done')];

  return (
    <div className="bg-surface-muted">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 md:py-12">
        <Stepper steps={steps} current={step} />

        {booking.status === 'ACTIVE' ? (
          <div className="mx-auto w-full max-w-lg">
            <Success booking={booking} />
          </div>
        ) : booking.status !== 'PENDING_PAYMENT' ? (
          <Card className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-xl p-8 text-center">
            <CircleX aria-hidden className="size-10 text-muted" />
            <h1 className="text-xl font-bold">{t('cancelledTitle')}</h1>
            <p className="text-muted">{t('cancelledDetail')}</p>
            <Link href={routes.search} className={buttonVariants()}>
              {t('backToSearch')}
            </Link>
          </Card>
        ) : (
          <div className="grid items-start gap-6 md:grid-cols-[1fr_22rem]">
            <Card className="flex flex-col gap-5 rounded-lg p-5 md:p-7">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <Badge tone="warning">{t('holdNotice')}</Badge>
              </div>
              <p className="flex gap-2 rounded-md bg-cream p-3 text-sm">
                <Info aria-hidden className="size-4 shrink-0 text-brand-text" />
                {t('testCard')}
              </p>
              {stripePromise && clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
                  <PaymentForm booking={booking} onPaid={refresh} />
                </Elements>
              ) : (
                <p className="text-sm text-danger">{t('notFound')}</p>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="self-center"
                disabled={cancel.isPending}
                onClick={() =>
                  void cancel.mutateAsync({ id }).then(() => {
                    refresh();
                    router.push(routes.search);
                  })
                }
              >
                {t('cancel')}
              </Button>
            </Card>
            <Summary booking={booking} />
          </div>
        )}
      </div>
    </div>
  );
}
