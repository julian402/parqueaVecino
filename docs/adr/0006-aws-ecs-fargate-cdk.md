# 0006 — AWS con CDK y ECS Fargate

- Estado: aceptada
- Fecha: 2026-11-26

## Contexto

Se necesita una infraestructura escalable y reproducible en AWS, con presupuesto de estudiante.

## Decisión

AWS CDK en TypeScript. API, web y worker como servicios en ECS Fargate detrás de un ALB; RDS,
ElastiCache y S3 para datos. Parámetros por ambiente en `infra/config`. CI con OIDC.

## Consecuencias

- Toda la infraestructura se crea y se destruye con un comando.
- Más costo que App Runner o Lambda en reposo; se mitiga con tamaños mínimos, sin NAT Gateway,
  `desiredCount=0` fuera de demos y alerta de AWS Budgets.
