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

- ☑ Esquema Prisma: User, RefreshToken, Vehicle, ParkingLot, Offer, SystemSetting (Booking/Payment/Document/Review en sus fases)
- ☑ Seed idempotente con datos demo (Chapinero, Calle 63, Cra 13…) y `system_settings`
- ☑ Módulo `settings` + `SettingsService` cacheado
- ☑ Módulo `auth` (cookies httpOnly, refresh rotativo, roles ADMIN/PARTNER/DRIVER, guards) + `users` (vehículos)
- ☑ Módulo `parking-lots` con cupos por franja (CRUD del aliado aislado por dueño, tope tarifario)
- ☑ OpenAPI → cliente Orval en `apps/web`
- ☑ Web: layout responsive (nav escritorio / tab bar celular), login/registro, panel aliado inicial, colores del folleto
- ☑ `pnpm setup:local` para levantar todo en un equipo nuevo
- ☑ **Infra:** CDK Network/Data/App/Ci/Ops; CD a AWS en cada push a `main` (OIDC con ambiente `prod` de GitHub)
- ☑ AWS Budgets con alerta de costo

**Entregable:** login funcionando en local y la app vacía desplegada en AWS.

## Fase 2 — Buscar, mapa y detalle (semanas 3–4) · Mockups 1, 2, 3

- ☑ `search`: consulta PostGIS por radio + filtros (franja, vehículo, precio máx., techo) + orden
- ☑ Geocodificación (`geocoding`, Nominatim con caché) y "usar mi ubicación"
- ☑ Pantalla Inicio (buscador con franja y vehículo) → `/buscar`
- ☑ Resultados: lista + mapa MapLibre/OpenFreeMap sincronizados, pines con precio y cupos, "Lleno"
- ☑ Detalle: bloque "Verificado", servicios, selector de franja con ahorro vs 24 h, mapa
- ◐ Fotos del parqueadero: campo `photos` + ilustraciones ficticias de los 13 demo (`apps/web/public/demo/parqueaderos`) ☑ · subida del aliado a S3 con URL prefirmada ☐
- ☑ 13 parqueaderos demo con coordenadas reales de Chapinero y alrededores
- ☐ Reseñas (lectura)

**Entregable:** un conductor encuentra parqueaderos cerca y ve el detalle.

## Fase 3 — Reserva y pago con Stripe (semanas 5–6) · Mockups 4, 5

- ☑ Stripe Connect (Accounts v2, panel Express): onboarding del aliado en modo test (`/aliados/pagos` → "Conectar pagos"),
  cargo con destino + `application_fee_amount`, reembolso con reversa de transferencia (ADR 0007).
  Sin cuenta activa cobra la plataforma. _Falta probarlo contra Stripe con una llave `sk_test` vigente._
- ☑ Puerto `PaymentProvider` + adaptador Stripe; idempotencia; firmas de webhook
- ◐ `bookings`: crear reserva, bloqueo atómico de cupo, máquina de estados y barrido de reservas sin pagar _(TTL en Redis pendiente; hoy un job en la API)_
- ☑ Checkout en 3 pasos (Datos → Pago → Listo) con Stripe Payment Element
- ☑ Comisión leída de `settings` y libro de movimientos (`payments`, con la cuenta de destino de cada cobro)
- ◐ Recibo con código de ingreso, QR y descarga en PDF (impresión del navegador) ☑ · PDF generado en el servidor y envío por correo ☐
- ☑ Cancelación gratuita durante N horas (N desde `settings`) con reembolso
- ☑ Pruebas de integración del webhook (`test/e2e/payments.e2e.ts`): eventos firmados con la forma de
  `stripe listen`, firma inválida → 400, idempotencia, rechazo reintentable, reembolso desde Stripe
- ☑ Webhook de Stripe en producción (`/api/payments/webhooks/stripe`), firma inválida → 400
- ☑ **Reservar sin cuenta (checkout como invitado → cuenta):** antes el visitante veía "Ingresa para
  reservar" y perdía el paso si iba a registrarse. Hecho:
  - En la ficha, sin sesión, el formulario de reserva pide nombre, correo, contraseña y placa en un
    solo paso → registro como `DRIVER` → guarda la placa en "Mis vehículos" → crea la reserva → checkout.
    La mensualidad, el pago, el recibo y el QR quedan en esa cuenta desde el inicio.
  - "¿Ya tienes cuenta? Ingresa" conserva la ficha (`next`) en login **y** en registro.
  - Correo ya registrado (409): mensaje claro con enlace a ingresar, sin perder la placa (`?placa=`).
  - En la pestaña de pago, aviso "Pagando como {nombre} · {correo}"; "Cambiar de cuenta" anula la
    reserva pendiente (libera el cupo), cierra sesión y vuelve a ingresar a la ficha.
  - Validación reutilizando `registerSchema` + `plateSchema` de `contracts` (`guestBookingSchema`);
    textos en `es.json`; e2e de API del flujo invitado → pago → "Mis mensualidades" (el e2e de
    navegador queda para Playwright en la Fase 7).
- ☐ Webhooks de cuentas conectadas (_thin events_ de Accounts v2); hoy el estado se consulta antes de cobrar

**Entregable:** reserva pagada de punta a punta en sandbox, con comisión visible en Stripe.

## Fase 4 — Mis mensualidades y panel del aliado (semanas 6–7) · Mockups 6, 7

- ☑ Panel del conductor (`/mi-cuenta`, barra lateral): resumen, mensualidades activas con vigencia y código, cancelar, historial, perfil y vehículos, renovar ☑
- ☑ Panel aliado con barra lateral: KPIs (ingreso neto, ocupación, mensualidades), ventas 14 días, editar datos, cupos y precios por franja, pausar ☑
- ☑ Gráfica de ocupación por hora (últimos 7 días) — `partner-analytics` (`GET /partner/analytics/occupancy`):
  promedio por hora de las mensualidades vigentes según la franja de cada una, contra los cupos publicados
- ☑ `verification`: póliza RC, RUT y facturación por parqueadero (`/aliados/documentos`), subida directa a S3
  con URL prefirmada, revisión del admin (`/admin/documentos`, rechazo con motivo), aviso por correo y
  pérdida del sello "Verificado" al vencer (ADR 0008)
- ☑ **Panel admin** (`/admin`, rol ADMIN, barra lateral): aprobar/suspender/verificar parqueaderos, CRUD de
  usuarios (crear, editar rol, suspender, borrar), pagos, estadísticas globales, editar `system_settings`
- ☑ Jobs BullMQ (puerto `JobScheduler`; Redis como contenedor de la tarea en AWS): barrido de reservas,
  aviso "tu mensualidad termina en N días" y documentos que vencen en N días (`system_settings`)

**Entregable:** los dos lados del marketplace operan.

## Fase 5 — Tiempo real y alertas (semana 8) · Atributos A2, A3

- ☐ Gateway Socket.IO + Redis adapter; eventos `availability.changed` por zona
- ☐ Mapa y detalle se actualizan sin recargar ("Actualizado hace 1 min")
- ☐ Suscripción a alertas por zona/franja; notificación por correo cuando se libera un cupo

## Fase 6 — Endurecimiento, escalabilidad y AWS completo (semana 9)

Estado actual en AWS (ambiente único `prod`, Stripe en modo test): una tarea Fargate (Caddy + web + API)
con IP pública publicada en DuckDNS, RDS `t4g.micro` en subred aislada, secretos en Secrets Manager,
certificado Let's Encrypt en EFS, logs en CloudWatch (se conservan si un despliegue se revierte) y
despliegue automático desde `main`. Sirve para demo; los pendientes de abajo son para escalar.

### Hecho

- ☑ CD: CI verde en `main` → `cdk deploy` (imágenes a ECR, migraciones y seed al arrancar)
- ☑ Health checks por contenedor y rollback automático (circuit breaker de ECS)
- ☑ Seguridad base: límite de intentos en auth (429), Helmet (CSP, HSTS, nosniff, frame), cookies
  httpOnly/Secure/SameSite, HTTPS forzado, argon2, 404 en recursos ajenos, webhooks firmados,
  `pnpm audit` sin hallazgos (override de `effect`), errores con formato estándar, sin secretos en git
- ☑ `GET /auth/session` (sin 401 para visitantes) y mensajes claros si la API no responde
- ☑ Rol de CI con `cloudformation:DescribeStacks` sobre los stacks del ambiente (paso "URL publicada")
- ☑ Favicon e ícono de la app (pin del logo) en `apps/web/src/app/`

### Escalabilidad (para pasar de 1 a N réplicas)

- ☐ **ALB + dominio propio** con certificado ACM: varias tareas detrás del balanceador y despliegues sin
  corte. Reemplaza Caddy/DuckDNS (DuckDNS solo admite un registro A). _≈ USD 16/mes + dominio._
- ☐ **Redis (ElastiCache `cache.t4g.micro`)** _≈ USD 12/mes_, usado para:
  - almacenamiento del límite de intentos (`@nestjs/throttler` con storage Redis; hoy es por réplica);
  - caché de geocodificación y de `system_settings` compartida (hoy en memoria);
  - bloqueo de cupo con TTL durante el pago (hoy fila en BD + barrido);
  - adapter de Socket.IO y colas BullMQ (Fase 5).
- ☐ **Worker aparte (BullMQ)**: los jobs ya van por BullMQ (una sola ejecución aunque haya varias
  réplicas), pero el worker corre dentro de la API; separarlo cuando haya carga (recibos PDF, correos).
- ☐ **Migraciones en una tarea ECS de un solo uso** antes del deploy (hoy al arrancar la API).
- ☐ **Autoscaling** del servicio por CPU/peticiones (mín. 1, máx. 3) una vez exista el ALB.
- ☐ Separar web y API en servicios distintos si el tráfico lo pide (hoy comparten tarea).

### AWS completo

- ◐ **S3** con URLs prefirmadas: documentos de verificación ☑ · fotos de parqueaderos y recibos PDF ☐;
  CloudFront delante de las imágenes ☐.
- ☐ **SES** para correos (avisos de vencimiento y revisión ya existen con SMTP/Mailpit; en AWS hoy solo
  se registran en el log), recibo y alertas de cupo.
- ☐ **Alarmas CloudWatch**: tarea caída, 5xx de la API, CPU/memoria, conexiones y almacenamiento de RDS;
  avisos al correo del presupuesto.
- ☐ RDS para datos reales: respaldo 7 días, `deletionProtection`, Multi-AZ opcional (hoy 1 día, sin
  protección y una zona, por costo).
- ☐ Logs estructurados con `requestId` de punta a punta (web → API) y retención por ambiente.

### Seguridad

- ☐ Desactivar Swagger en producción (`swaggerEnabled: false` en `infra/config/prod.ts`) o protegerlo con rol ADMIN.
- ☐ Contraseñas del seed: una distinta por cuenta demo y cambio obligatorio del admin en el primer
  ingreso; rotar `SeedSecret` (se aplica sola al reiniciar).
- ☐ Revisión OWASP básica: CSRF (hoy mitigado con `SameSite=Lax` + JSON), validación de subida de
  archivos (S3), límites de tamaño de cuerpo, enumeración de correos en registro.
- ☐ Límite de peticiones general (no solo auth) y WAF básico frente al ALB.
- ☐ Dependabot/Renovate y `pnpm audit` en CI; escaneo de imágenes en ECR.
- ☐ Rotación periódica de llaves (JWT, Stripe test) documentada en el README.

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
