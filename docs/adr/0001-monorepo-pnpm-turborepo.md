# 0001 — Monorepo con pnpm + Turborepo

- Estado: aceptada
- Fecha: 2026-11-26

## Contexto

Web, API e infraestructura comparten tipos, enums, validaciones y componentes. Equipo de 8 personas.

## Decisión

Un solo repositorio con pnpm workspaces y Turborepo: `apps/*`, `packages/*`, `infra`.

## Consecuencias

- Un cambio de contrato se ve en front y back en el mismo PR.
- Builds y pruebas con caché; CI solo recompila lo afectado.
- Los paquetes compartidos (`contracts`, `utils`) se compilan con tsup antes de usarse (`dependsOn: ^build`).
