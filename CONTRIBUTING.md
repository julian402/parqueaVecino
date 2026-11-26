# Cómo contribuir

## Ramas

Solo hay dos ramas permanentes:

| Rama      | Quién                  | Qué pasa al hacer push                                    |
| --------- | ---------------------- | --------------------------------------------------------- |
| `develop` | Todo el equipo         | CI (formato, lint, tipos, pruebas, build, e2e)            |
| `main`    | Solo el dueño del repo | CI y, si pasa, **despliegue automático** a la URL pública |

- El equipo trabaja y hace push a `develop` (siempre `git pull --rebase` antes de subir).
- El dueño integra `develop` → `main` cuando el CI de `develop` está en verde.
- Ramas temporales (`feat/…`) son opcionales y locales; no se suben al remoto.

## Commits

- Formato **Conventional Commits**: `tipo(alcance): descripción en español, en imperativo`.
  - Tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `ci`, `build`, `infra`.
  - Alcance = módulo o paquete: `api/bookings`, `web/search`, `ui`, `infra`, `contracts`.
  - Ejemplo: `feat(api/bookings): bloquea el cupo durante el checkout`
- **Autoría:** cada commit lleva únicamente al autor humano que lo hace.
  **Prohibido** agregar `Co-authored-by` (de personas o de herramientas de IA). Un hook de
  `commit-msg` lo rechaza.
- Commits pequeños y atómicos; nada de "cambios varios".
- Nunca commitear `.env`, llaves, credenciales ni `node_modules`.

## Antes de subir

- `pnpm format && pnpm lint && pnpm typecheck && pnpm test` en verde.
- Debe cumplir la Definición de Hecho de `docs/PLAN.md`.

## Código

Ver reglas completas en [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) (aplican a personas y a asistentes de IA por igual).
