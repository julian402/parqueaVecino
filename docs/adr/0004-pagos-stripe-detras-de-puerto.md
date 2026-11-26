# 0004 — Pagos con Stripe (modo test) detrás del puerto PaymentProvider

- Estado: aceptada
- Fecha: 2026-11-26

## Contexto

El proyecto no sale a producción, pero debe demostrar pagos de punta a punta con comisión del 10 %.
Stripe no opera con comercios colombianos ni ofrece PSE/Nequi; los mockups mencionan Wompi.

## Decisión

Stripe en modo test con Connect Express (`application_fee_amount`) para la comisión. El dominio solo
conoce `PaymentProvider`; Stripe vive en `payments/infrastructure`.

## Consecuencias

- Flujo completo demostrable (onboarding del aliado, cobro, comisión, webhooks, reembolsos).
- Migrar a Wompi u otra pasarela es escribir un adaptador nuevo.
