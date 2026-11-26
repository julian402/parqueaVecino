# Plan de trabajo — ParqueaVecino

Iteraciones de **1 semana**. Cada fase termina con algo demostrable. La infraestructura de AWS
arranca temprano (Fase 1) para no descubrir problemas de despliegue al final.

Leyenda: ☐ pendiente · ◐ en curso · ☑ hecho

---

## Fase 0 — Fundaciones (semana 1)

Objetivo: cualquier integrante clona, corre `pnpm i && pnpm dev` y tiene todo arriba.

- ◐ Crear repositorio en GitHub ☑ · proteger `main` (PR obligatorio, CI verde, squash merge) ☐
- ☑ Monorepo pnpm + Turborepo con `apps/web`, `apps/api`, `packages/{ui,contracts,utils,config}`, `infra/`
- ☑ `packages/config`: tsconfig base (strict), ESLint, Prettier; tokens Tailwind v4 en `packages/ui/src/styles/tokens.css`
- ☑ Husky + lint-staged + commitlint (Conventional Commits) + hook que **rechaza `Co-authored-by`**
- ☑ `docker/docker-compose.yml`: postgres+postgis, redis, s3mock, mailpit, stripe-cli
- ☑ Validación de entorno con Zod en api y web; `.env.example` completos
- ☑ CI en GitHub Actions: install → lint → typecheck → test → build (con caché de Turbo)
- ◐ Plantillas de PR e issues; tablero de GitHub Projects con las historias de este plan _(falta el tablero de GitHub Projects)_
- ☑ ADRs 0001–0006 (ver ARCHITECTURE.md §8)
- ☑ Extraer tokens y componentes base de los mockups (Button, Pill, Badge, Card, Input, Stepper)

**Entregable:** repo funcionando en local + CI verde.

## Fase 1 — Núcleo de dominio + esqueleto en AWS (semanas 2–3)

- ☐ Esquema Prisma: User, Vehicle, ParkingLot (geography Point), Offer (franja, total, precio), Booking, Payment, LedgerEntry, Document, Review, SystemSetting
- ☐ Seed con datos de demo realistas (Chapinero, Calle 63, Cra 13…) y `system_settings`
- ☐ Módulo `settings` + `SettingsService` cacheado
- ☐ Módulo `auth` (registro/login/refresh, roles, guards) + `users` (vehículos)
- ☐ Módulos `parking-lots` y `offers` (CRUD aliado, validación de tope tarifario)
- ☐ OpenAPI → cliente Orval en `apps/web`
- ☐ Web: layout responsive (nav escritorio / tab bar celular), login/registro
- ☐ **Infra:** CDK `NetworkStack`, `DataStack`, `AppStack` mínimos; OIDC para GitHub; primer deploy de "hola mundo" api+web en `dev`
- ☐ AWS Budgets con alerta de costo

**Entregable:** login funcionando en local y la app vacía desplegada en AWS.

## Fase 2 — Buscar, mapa y detalle (semanas 3–4) · Mockups 1, 2, 3

- ☐ `search`: consulta PostGIS por radio + filtros (franja, vehículo, precio máx., techo) + orden
- ☐ Pantalla Inicio (buscador con franja y vehículo)
- ☐ Resultados: lista + mapa MapLibre sincronizados, pines con precio y cupos, "Lleno"
- ☐ Detalle: fotos (S3), bloque "Verificado" con póliza, selector de franja con ahorro vs 24 h
- ☐ Reseñas (lectura)

**Entregable:** un conductor encuentra parqueaderos cerca y ve el detalle.

## Fase 3 — Reserva y pago con Stripe (semanas 5–6) · Mockups 4, 5

- ☐ Stripe Connect Express: onboarding del aliado en modo test (panel aliado → "Conectar pagos")
- ☐ Puerto `PaymentProvider` + adaptador Stripe; idempotencia; firmas de webhook
- ☐ `bookings`: crear reserva, bloqueo de cupo con TTL en Redis, máquina de estados
- ☐ Checkout en 3 pasos (Datos → Pago → Listo) con Stripe Payment Element
- ☐ Comisión vía `application_fee_amount` leída de `settings`; libro de movimientos
- ☐ Recibo: código de ingreso + QR + PDF (`receipts`) + correo (Mailpit/SES)
- ☐ Cancelación gratuita hasta N horas antes (N desde `settings`) con reembolso
- ☐ Pruebas de integración del webhook con eventos de Stripe CLI

**Entregable:** reserva pagada de punta a punta en sandbox, con comisión visible en Stripe.

## Fase 4 — Mis mensualidades y panel del aliado (semanas 6–7) · Mockups 6, 7

- ☐ Mis mensualidades: activas/vencidas, barra de vigencia, renovar, ver QR, cancelar, historial de pagos
- ☐ Panel aliado: KPIs (ocupación día/noche, ingreso extra, reservas nuevas), editar cupos por franja
- ☐ Gráfica de ocupación por hora (últimos 7 días) — `partner-analytics`
- ☐ `verification`: carga de documentos a S3 (URL prefirmada), estados y vencimientos; panel admin para aprobar
- ☐ Jobs BullMQ: vencimiento de mensualidades y de documentos (aviso "vence en 20 días")

**Entregable:** los dos lados del marketplace operan.

## Fase 5 — Tiempo real y alertas (semana 8) · Atributos A2, A3

- ☐ Gateway Socket.IO + Redis adapter; eventos `availability.changed` por zona
- ☐ Mapa y detalle se actualizan sin recargar ("Actualizado hace 1 min")
- ☐ Suscripción a alertas por zona/franja; notificación por correo cuando se libera un cupo

## Fase 6 — Endurecimiento y AWS completo (semana 9)

- ☐ Stacks completos: Redis, S3, CloudFront, Secrets Manager, Amazon Location, alarmas
- ☐ CD: build de imágenes → ECR → migración (tarea ECS) → deploy; deploy automático al merge en `main`
- ☐ Autoscaling, health checks, logs estructurados con `requestId`
- ☐ Seguridad: rate limiting, Helmet, CORS por config, revisión OWASP básica, `pnpm audit`
- ☐ Webhook de Stripe apuntando al ambiente `dev` en AWS

## Fase 7 — QA, demo y cierre (semana 10)

- ☐ E2E con Playwright de los 3 flujos críticos (buscar→pagar, aliado publica cupo, renovar)
- ☐ Datos de demo y guion de presentación
- ☐ Documentación final (README, arquitectura, cómo desplegar, cómo apagar costos)
- ☐ Plan de apagado: `desiredCount=0` / `cdk destroy`

---

## Reparto sugerido (8 integrantes)

| Rol                    | Personas | Foco                                          |
| ---------------------- | -------- | --------------------------------------------- |
| Líder técnico / DevOps | 1        | Monorepo, CI/CD, CDK, revisiones de PR        |
| Backend                | 3        | Dominio, búsqueda, reservas, pagos, jobs      |
| Frontend               | 3        | UI kit, pantallas conductor y aliado, mapa    |
| QA / Producto          | 1        | Historias, criterios de aceptación, e2e, demo |

## Definición de Hecho (DoD)

Una historia está terminada cuando: cumple criterios de aceptación · tiene pruebas · pasa CI ·
no introduce valores quemados · textos en `es.json` · responsive (375 px y 1280 px como en los
mockups) · revisada por al menos 1 compañero · documentada si cambia arquitectura (ADR).

## Fuera de alcance (por ahora)

Producción real, pasarela colombiana (Wompi/PSE/Nequi), WhatsApp, app nativa, insignias (Kano:
indiferente), historial de búsquedas y compartir en redes (Kano: indiferentes).
