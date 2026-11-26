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

Requisitos: Node 24, pnpm y Docker Desktop abierto.

```bash
git clone https://github.com/julian402/parqueaVecino.git && cd parqueaVecino
git switch develop
pnpm install
pnpm setup:local      # .env, CLAUDE.md local, Docker, migraciones y datos demo
pnpm dev              # web en :3000, api en :3001
```

`pnpm setup:local` es idempotente y nunca sobrescribe tus archivos locales. Crea:

- `apps/api/.env` y `apps/web/.env.local` desde los `.env.example`.
- `CLAUDE.md` y `.claude/settings.json` desde `tooling/claude/` (git los ignora; edítalos a tu gusto).
- La base de datos local (PostgreSQL 17 + PostGIS en el puerto **5433**) con migraciones y datos demo:
  admin, aliado y conductor demo (correos y contraseñas en `apps/api/.env`, variables `SEED_*`).

Pruebas e2e de la API (usan una BD aparte, `parqueavecino_test`): `pnpm --filter @parqueavecino/api test:e2e`.

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

## AWS y despliegue

- **Un solo ambiente: `prod` de pruebas.** URL pública, pero Stripe en modo test (pagos ficticios) y datos demo.
- **CD:** cada push a `main` corre el CI y, si pasa, `.github/workflows/deploy.yml` despliega con CDK
  usando OIDC (sin llaves guardadas). Variables del repo en GitHub (Settings → Variables):
  `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION=us-east-2` y opcional `BUDGET_EMAIL`.
- URL: **https://parquea-vecino.duckdns.org**
- Infra: DuckDNS → Fargate (Caddy con HTTPS de Let's Encrypt + web + api) → RDS PostgreSQL 17 + PostGIS (`db.t4g.micro`).
- **Token de DuckDNS** (una sola vez, nunca en el repo): cópialo de duckdns.org y guárdalo en el secreto
  `DuckDnsSecretName` que imprime el despliegue:

  ```bash
  aws secretsmanager put-secret-value --secret-id <DuckDnsSecretName> --secret-string <token>     --profile <perfil> --region us-east-2
  aws ecs update-service --cluster <ClusterName> --service <ServiceName> --force-new-deployment     --profile <perfil> --region us-east-2
  ```

- Región: **`us-east-2` (Ohio)**. La organización de la cuenta bloquea las demás regiones.
- Configura tu perfil con `aws configure --profile <perfil>` (región `us-east-2`) y úsalo con
  `AWS_PROFILE=<perfil>` antes de los comandos de CDK. Nunca subas llaves al repo.

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
