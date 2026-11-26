# Convenciones del proyecto

Aplican a todo el equipo y a cualquier herramienta (incluida IA). Contexto: `ARCHITECTURE.md` y `PLAN.md`.

## Git
- Commits en Conventional Commits, en español: `tipo(alcance): descripción`.
- **Nunca** agregar `Co-authored-by` ni ninguna atribución a IA en commits ni PRs. El único autor es la persona que hace el commit.
- Trabajar en ramas `feat/…`, `fix/…`, `infra/…`; `main` solo por PR.

## Arquitectura
- Monorepo pnpm + Turborepo: `apps/web` (Next.js), `apps/api` (NestJS), `packages/{ui,contracts,utils,config}`, `infra/` (AWS CDK).
- API organizada por módulos de dominio: `apps/api/src/modules/<modulo>/{presentation,application,domain,infrastructure}`.
  - Controllers delgados; la lógica va en `application/`.
  - `application/` no importa Prisma, Stripe ni AWS SDK directamente: usa puertos (interfaces) de `domain/` implementados en `infrastructure/`.
  - Un módulo no accede a las tablas de otro: usa su servicio exportado.
- Web por features: `apps/web/src/features/<feature>/`. Las páginas de `app/` solo componen.
- El cliente HTTP del front se genera desde OpenAPI (Orval); no escribir fetch a mano a la API.

## Nada quemado
- Config/URLs/llaves → variables de entorno validadas con Zod; actualizar `.env.example` al agregar una.
- Reglas de negocio (comisión, horarios de franjas, tope tarifario, ventana de cancelación, radios) → `system_settings` vía `SettingsService`.
- Textos de UI → `apps/web/messages/es.json`.
- Colores/espaciados → tokens del preset Tailwind; no hex ni px sueltos en componentes.
- Enums y esquemas compartidos → `packages/contracts` (fuente única).
- Dinero en enteros (unidades menores) + moneda; formatear solo con `packages/utils`.
- Fechas con la zona `APP_TIMEZONE` (America/Bogota).

## Reutilización
- Antes de crear un componente, buscar en `packages/ui`. Si algo se usa en 2+ features, va a `packages/ui` o `packages/utils`.
- Sin duplicar validaciones: un esquema Zod en `contracts` sirve para API y formularios.

## Calidad
- TypeScript `strict`, sin `any` (usar `unknown` + validación).
- Toda lógica de negocio con pruebas unitarias (Vitest); endpoints con pruebas de integración; flujos críticos con Playwright.
- Errores con el formato estándar del filtro global; logs con pino (sin `console.log`).
- Responsive obligatorio: verificar en 375 px y 1280 px (como los mockups).

## Pagos
- Solo Stripe modo test. Toda llamada a Stripe con idempotency key; webhooks siempre verificados por firma.
- El dominio usa `PaymentProvider`; nunca llamar al SDK de Stripe fuera de `payments/infrastructure`.

## Infra
- Todo recurso AWS se crea con CDK (`infra/`), nunca a mano en la consola.
- Tamaños y parámetros por ambiente en `infra/config/<ambiente>.ts`.
- Secretos en Secrets Manager/SSM; acceso de CI por OIDC.
- Cuidar costos: instancias mínimas, sin NAT Gateway en dev, alarmas de presupuesto.
