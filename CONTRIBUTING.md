# Cómo contribuir

## Ramas

- `main` está protegida: solo entra código por Pull Request con CI verde y al menos 1 aprobación.
- Ramas cortas desde `main`: `feat/<tema>`, `fix/<tema>`, `chore/<tema>`, `docs/<tema>`, `infra/<tema>`.
- Merge con **squash**. Borrar la rama al cerrar el PR.

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

## Pull Requests

- Título en formato de commit. Descripción: qué, por qué, cómo probarlo, capturas (si es UI).
- Enlazar el issue (`Closes #N`).
- Debe cumplir la Definición de Hecho de `docs/PLAN.md`.

## Código

Ver reglas completas en [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) (aplican a personas y a asistentes de IA por igual).
