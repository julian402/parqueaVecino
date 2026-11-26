# ParqueaVecino

Mensualidades de parqueadero fraccionadas: paga solo la franja que usas (día o noche).
Proyecto de Innovación, Uniempresarial — Semestre IV.

- Arquitectura y stack: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Plan de trabajo: [`docs/PLAN.md`](docs/PLAN.md)
- Convenciones: [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md)
- Decisiones (ADR): [`docs/adr/`](docs/adr)
- Cómo contribuir: [`CONTRIBUTING.md`](CONTRIBUTING.md)

## Requisitos

- Node.js 24 (`.nvmrc`) y pnpm 11 (`corepack enable`)
- Docker Desktop
- AWS CLI v2 (solo para desplegar)

> En Windows, clona el repo fuera de OneDrive/Dropbox (p. ej. `C:\dev`): la sincronización de
> `node_modules` vuelve todo muy lento.

## Arranque local

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm docker:up        # postgres+postgis, redis, s3 local, mailpit
pnpm dev              # web en :3000, api en :3001
```

| Servicio          | URL                            |
| ----------------- | ------------------------------ |
| Web               | http://localhost:3000          |
| API               | http://localhost:3001/api      |
| Swagger           | http://localhost:3001/api/docs |
| Health            | http://localhost:3001/health   |
| Mailpit (correos) | http://localhost:8025          |
| S3 local          | http://localhost:9000          |

Webhooks de Stripe (modo test): crea `docker/.env` con `STRIPE_SECRET_KEY=sk_test_...` y ejecuta
`pnpm docker:stripe`.

## Scripts

| Comando                                      | Qué hace                                  |
| -------------------------------------------- | ----------------------------------------- |
| `pnpm dev`                                   | Levanta todas las apps en modo desarrollo |
| `pnpm build`                                 | Compila todo (paquetes primero)           |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Calidad (lo mismo que corre el CI)        |
| `pnpm format`                                | Formatea con Prettier                     |
| `pnpm --filter @parqueavecino/infra synth`   | Genera las plantillas de CloudFormation   |

## Estructura

```
apps/web            Next.js (conductor, aliados, admin)
apps/api            NestJS (módulos de dominio en src/modules)
packages/ui         Componentes y tokens de diseño
packages/contracts  Enums y esquemas Zod compartidos
packages/utils      Dinero, fechas
packages/config     tsconfig y ESLint compartidos
infra               AWS CDK
docker              Servicios locales
```
