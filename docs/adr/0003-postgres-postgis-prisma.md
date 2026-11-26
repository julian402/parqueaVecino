# 0003 — PostgreSQL + PostGIS con Prisma

- Estado: aceptada
- Fecha: 2026-11-26

## Contexto

La búsqueda principal es "parqueaderos con cupo cerca de mí" (mapa, distancia, radio).

## Decisión

PostgreSQL 16+ con la extensión PostGIS (RDS la soporta). Prisma como ORM y para las migraciones;
las consultas geoespaciales usan SQL tipado (`$queryRaw`) dentro del repositorio de `search`.

## Consecuencias

- Distancias e índices espaciales (GiST) nativos.
- Las columnas `geography` se manejan con SQL en las migraciones, porque Prisma no las modela directamente.
