# 0002 — Backend en NestJS organizado por módulos de dominio

- Estado: aceptada
- Fecha: 2026-11-26

## Contexto

Se pide organización por módulos, reutilización y que no haya acoplamiento a proveedores (Stripe, AWS).

## Decisión

NestJS con un módulo por subdominio y capas `presentation / application / domain / infrastructure`.
Los proveedores externos se usan a través de puertos (interfaces) definidos en `domain`.

## Consecuencias

- Inyección de dependencias y guards por rol listos.
- OpenAPI automático, que alimenta el cliente generado del front (Orval).
- Algo más de estructura por módulo, a cambio de poder probar los casos de uso sin infraestructura.
