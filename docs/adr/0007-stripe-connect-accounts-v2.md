# 0007 — Stripe Connect con Accounts v2 y cargos con destino

- Estado: aceptada
- Fecha: 2026-11-26
- Complementa: 0004

## Contexto

La ADR 0004 previó Connect Express para cobrar la comisión. Hasta ahora todo pago llegaba a la
cuenta de la plataforma y la comisión solo se anotaba en el libro. Stripe recomienda hoy crear las
cuentas conectadas con **Accounts v2** (`/v2/core/accounts`) en lugar de `type: 'express'` (v1).
Colombia no está disponible en Connect: en modo test las cuentas de los aliados se crean en US.

## Decisión

- Cuenta conectada por aliado con Accounts v2: panel `express`, configuración `recipient`
  (capacidad `stripe_balance.stripe_transfers`), la plataforma cobra las tarifas y asume las pérdidas
  (`fees_collector` y `losses_collector` = `application`). Onboarding alojado por Stripe (Account Link).
- **Cargo con destino**: `transfer_data.destination` = cuenta del aliado y
  `application_fee_amount` = comisión de `system_settings`. El reembolso revierte la transferencia y
  devuelve la comisión (`reverse_transfer`, `refund_application_fee`).
- El estado de la cuenta se consulta en Stripe al abrir "Pagos" y **antes de cada cobro**. Si no está
  activa, o Stripe no responde, cobra la plataforma (como antes): nunca se bloquea una venta.
- Sin webhooks de cuentas por ahora: los eventos de Accounts v2 son _thin events_ que llegan a un
  destino de eventos aparte. La consulta antes de cobrar cubre el caso.
- País de las cuentas (`STRIPE_CONNECT_COUNTRY`) y URL de regreso (`WEB_URL`) son configuración.

## Consecuencias

- La comisión se ve en Stripe como _application fee_ y el aliado ve sus pagos en su panel Express.
- Cada cobro hace una consulta extra a Stripe (latencia baja, aceptable para la demo).
- Si se activan webhooks de cuentas v2, solo cambia el adaptador y un handler.
