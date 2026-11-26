# Arquitectura y stack — ParqueaVecino

> Plataforma B2C que conecta conductores con parqueaderos públicos aliados para vender
> **mensualidades fraccionadas** (Día / Noche / 24 h). Ingreso: 10 % de comisión al parqueadero
> por cada mes activo. Fuente: `Proyecto Parquea Vecino (Pivote) corregido.pdf`, encuesta Kano y mockups.

## 1. Stack recomendado

Un solo lenguaje (TypeScript) de punta a punta: front, back, contratos e infraestructura.

| Capa              | Tecnología                                                                                                      | Por qué                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Monorepo          | **pnpm workspaces + Turborepo**                                                                                 | Paquetes compartidos (UI, contratos, utilidades), builds con caché, un solo `pnpm dev`.                                |
| Frontend          | **Next.js 15 (App Router) + React + TypeScript**                                                                | SSR/SEO para la parte pública, rutas por rol, responsive (los mockups son una sola app web para escritorio y celular). |
| Estilos / UI      | **Tailwind CSS v4 + shadcn/ui (Radix)** en `packages/ui`                                                        | Componentes propios y reutilizables; tokens en `packages/ui/src/styles/tokens.css` (`@theme`).                         |
| Estado servidor   | **TanStack Query** + cliente generado con **Orval** desde OpenAPI                                               | Cero endpoints escritos a mano en el front; tipos sincronizados con la API.                                            |
| Formularios       | **React Hook Form + Zod**                                                                                       | Validaciones compartidas con el backend.                                                                               |
| Textos            | **next-intl** (`messages/es.json`)                                                                              | Ningún texto de UI quemado en componentes.                                                                             |
| Mapa              | **MapLibre GL** (tiles de Amazon Location Service en AWS; OSM/MapTiler en local)                                | Libre, sin lock-in; el proveedor de tiles es configuración.                                                            |
| Backend           | **NestJS 11** (módulos, inyección de dependencias)                                                              | Organización por módulos de dominio "de fábrica", guards por rol, OpenAPI automático.                                  |
| ORM / BD          | **Prisma + PostgreSQL 16 + PostGIS**                                                                            | Búsqueda geoespacial ("a 350 m de ti"), migraciones versionadas.                                                       |
| Tiempo real       | **Socket.IO (Gateway de NestJS) + Redis adapter**                                                               | Cupos libres en vivo en el mapa (atributo A2), escalable horizontalmente.                                              |
| Colas / jobs      | **BullMQ sobre Redis**                                                                                          | Alertas de cupo (A3), correos, vencimientos de mensualidades y documentos.                                             |
| Pagos             | **Stripe (modo test) + Stripe Connect Express** detrás de un puerto `PaymentProvider`                           | Marketplace con comisión (`application_fee`), webhooks, todo en sandbox. Cambiable a Wompi sin tocar el dominio.       |
| Archivos          | **S3** (S3Mock en local) con URLs prefirmadas                                                                   | Fotos de parqueaderos y documentos de verificación (póliza, RUT).                                                      |
| Correo            | **Amazon SES** (Mailpit en local)                                                                               | Confirmaciones y alertas.                                                                                              |
| Auth              | Módulo propio: **argon2 + JWT** (access corto + refresh en cookie httpOnly), roles `DRIVER`, `PARTNER`, `ADMIN` | Funciona igual en local y en AWS; Cognito queda como mejora opcional (ADR).                                            |
| Logs              | **pino** (JSON) → CloudWatch                                                                                    | Estructurados, con `requestId`.                                                                                        |
| Pruebas           | **Vitest** (unit), **Supertest** (API), **Playwright** (e2e)                                                    |                                                                                                                        |
| Infra como código | **AWS CDK (TypeScript)**                                                                                        | Mismo lenguaje que la app; stacks por capa y por ambiente.                                                             |
| CI/CD             | **GitHub Actions** + OIDC hacia AWS                                                                             | Sin llaves de AWS guardadas en el repo ni en secretos de larga vida.                                                   |

### Nota sobre pagos en Colombia

Stripe no abre cuentas a comercios colombianos ni soporta PSE/Nequi. Como el proyecto **no va a
producción**, Stripe en modo test sirve perfecto para demostrar el flujo completo (reserva → pago →
comisión → webhook → recibo). Por eso el dominio solo conoce la interfaz `PaymentProvider`; el
adaptador `StripePaymentProvider` es una implementación y mañana puede existir `WompiPaymentProvider`
(la pasarela que mencionan los mockups) sin cambiar casos de uso.

## 2. Estructura del monorepo

```
parqueavecino/
├─ apps/
│  ├─ web/                 Next.js: sitio público, conductor y panel de aliados (route groups)
│  └─ api/                 NestJS: API REST + WebSocket + workers BullMQ
├─ packages/
│  ├─ ui/                  Design system: componentes shadcn adaptados + tokens
│  ├─ contracts/           Esquemas Zod, enums y tipos compartidos (Franja, EstadoReserva, Rol…)
│  ├─ utils/               Dinero (COP en unidades menores), fechas (America/Bogota), helpers puros
│  └─ config/              tsconfig y eslint compartidos
├─ infra/                  AWS CDK: stacks + config por ambiente
├─ docker/                 docker-compose local: postgres+postgis, redis, s3mock, mailpit, stripe-cli
├─ docs/                   Este documento, PLAN.md, ADRs (docs/adr/NNNN-titulo.md)
└─ .github/workflows/      CI (lint, typecheck, test, build) y CD (deploy a AWS)
```

## 3. Módulos de la API (NestJS)

Cada módulo es una carpeta autocontenida en `apps/api/src/modules/<modulo>/`:

```
<modulo>/
├─ <modulo>.module.ts
├─ presentation/     controllers, DTOs (derivados de packages/contracts), gateways
├─ application/      casos de uso / services (lógica de negocio, sin Prisma ni Stripe directo)
├─ domain/           entidades, reglas, puertos (interfaces) p. ej. PaymentProvider
└─ infrastructure/   repositorios Prisma, adaptadores (Stripe, S3, SES)
```

| Módulo              | Responsabilidad                                                                       | Pantalla / atributo Kano |
| ------------------- | ------------------------------------------------------------------------------------- | ------------------------ |
| `auth`              | Registro, login, refresh, roles y guards                                              | —                        |
| `users`             | Perfil del conductor, vehículos (placa, tipo)                                         | 4, 6                     |
| `parking-lots`      | Parqueadero: dirección, geolocalización, servicios, fotos                             | 3, 7                     |
| `offers`            | Cupos por franja (DAY/NIGHT/FULL): total, precio, validación de tope tarifario        | 3, 7 · A1                |
| `search`            | Búsqueda geoespacial + filtros (franja, vehículo, precio, techo) y orden              | 1, 2 · N1                |
| `availability`      | Cupos libres en tiempo real (WebSocket + Redis pub/sub)                               | 2 · A2                   |
| `bookings`          | Mensualidades: reserva, vigencia, renovar, cancelar, código de ingreso/QR             | 4, 5, 6                  |
| `payments`          | Puerto `PaymentProvider`, Stripe Connect, webhooks, libro de movimientos, comisión    | 4 · N3                   |
| `verification`      | Documentos del aliado (póliza RC, RUT, facturación), vencimientos, sello "Verificado" | 3, 7 · N2                |
| `notifications`     | Correos, alertas "se liberó un cupo en tu zona" (BullMQ)                              | 5 · A3                   |
| `receipts`          | Recibo PDF con placa, vigencia y póliza (Ley 1801 art. 90)                            | 5                        |
| `partner-analytics` | Ocupación por franja/hora, ingreso extra, reservas nuevas                             | 7                        |
| `reviews`           | Calificación y reseñas                                                                | 3                        |
| `admin`             | Aprobación de aliados y documentos                                                    | —                        |
| `settings`          | Parámetros de negocio editables (ver §5)                                              | transversal              |

Transversal en `apps/api/src/common/`: `ConfigModule` validado con Zod, logger, filtro de errores
estándar, paginación, `RequestId`, health checks (`/health`).

## 4. Frontend (Next.js)

```
apps/web/src/
├─ app/
│  ├─ (public)/        inicio, cómo funciona, para parqueaderos
│  ├─ (driver)/        buscar, detalle, checkout, recibo, mis-mensualidades
│  ├─ (partner)/       panel, cupos, reservas, pagos, documentos
│  └─ (admin)/
├─ features/<feature>/ components/, hooks/, api/ (generado), schemas/
├─ lib/                cliente HTTP, socket, env.ts (Zod)
└─ messages/es.json
```

Reglas: las páginas (`app/`) solo componen; la lógica vive en `features/`. Componentes genéricos
(Button, Card, Pill, Badge "Verificado", PriceTag, MapPin, StatCard, DataTable, Stepper) van en
`packages/ui` y se identifican desde los mockups.

## 5. Nada quemado (no hardcode)

| Qué                                                                                                                                   | Dónde vive                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| URLs, credenciales, llaves Stripe, buckets, región                                                                                    | Variables de entorno validadas con Zod al arrancar (`.env.example` versionado, `.env` nunca). En AWS: Secrets Manager / SSM Parameter Store. |
| Comisión (10 %), horarios de franjas, ventana de cancelación (24 h), tope tarifario (Decreto 098/2024), radio de búsqueda por defecto | Tabla `system_settings` + seed; editable por admin; leída vía `SettingsService` con caché.                                                   |
| Textos de UI                                                                                                                          | `messages/es.json`                                                                                                                           |
| Colores, espaciados, tipografía                                                                                                       | Tokens `@theme` en `packages/ui/src/styles/tokens.css`                                                                                       |
| Enums (franja, estado de reserva, rol, tipo de vehículo, tipo de documento)                                                           | `packages/contracts` (fuente única, usada por Prisma, API y web)                                                                             |
| Dinero                                                                                                                                | Entero en unidades menores + moneda; formateo solo con `packages/utils/money`                                                                |
| Zona horaria                                                                                                                          | `APP_TIMEZONE=America/Bogota`                                                                                                                |
| Tamaños de infraestructura por ambiente                                                                                               | `infra/config/<ambiente>.ts`                                                                                                                 |

## 6. Flujo de pago (sandbox)

1. Aliado hace onboarding a Stripe Connect Express (modo test) desde su panel.
2. Conductor elige franja → `POST /bookings` crea reserva `PENDING_PAYMENT` y **bloquea el cupo**
   con TTL (Redis) para evitar sobreventa.
3. API crea PaymentIntent/Checkout con `application_fee_amount = precio × comisión` (de `settings`)
   y `transfer_data.destination = cuenta del aliado`, con _idempotency key_.
4. Webhook firmado (`payment_intent.succeeded` / `payment_failed`, `charge.refunded`,
   `account.updated`) → actualiza reserva a `ACTIVE`, registra movimientos, emite evento de
   disponibilidad, encola correo + recibo.
5. Local: `stripe listen --forward-to localhost:<API_PORT>/payments/webhooks/stripe` (contenedor stripe-cli).

Estados de reserva: `PENDING_PAYMENT → ACTIVE → EXPIRED | CANCELLED | REFUNDED`.

## 7. Infraestructura AWS (CDK)

```
NetworkStack   VPC 2 AZ, subredes públicas/privadas, security groups
DataStack      RDS PostgreSQL 16 (PostGIS), ElastiCache (Valkey/Redis), S3 (uploads, recibos)
AppStack       ECR, ECS Fargate: servicio api, servicio web, servicio worker; ALB + ACM
EdgeStack      CloudFront (web + assets), Route 53 (si hay dominio)
SecretsStack   Secrets Manager (BD, JWT, Stripe), SSM Parameters
OpsStack       CloudWatch logs/alarmas, AWS Budgets (alerta de costo), Amazon Location (mapas)
CiStack        Rol OIDC para GitHub Actions
```

- Ambientes: `dev` (sandbox, el que se demuestra) y opcional `staging`. Mismo código, distinta config.
- Migraciones: tarea ECS de un solo uso (`prisma migrate deploy`) antes de actualizar servicios.
- Escalabilidad: servicios stateless + autoscaling por CPU; sockets escalan por el adapter de Redis;
  jobs aislados en el worker.
- **Costos de estudiante:** RDS `t4g.micro`, Fargate 0.25 vCPU, evitar NAT Gateway (≈ USD 32/mes)
  con NAT instance o tareas en subred pública con SG estrictos; `desiredCount=0` cuando no hay demo;
  presupuesto con alerta en AWS Budgets; `cdk destroy` al terminar el semestre.

## 8. Decisiones (ADRs)

Toda decisión relevante se documenta en `docs/adr/NNNN-titulo.md` (contexto, decisión,
consecuencias). Primeras ADRs: monorepo, NestJS, Prisma+PostGIS, Stripe detrás de puerto, auth
propia vs Cognito, ECS Fargate vs App Runner.
