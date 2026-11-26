# Imagen de la API (NestJS). Contexto de build: raíz del repositorio.
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@parqueavecino/api
# Copia aislada solo con dependencias de producción (incluye contracts/utils compilados).
RUN pnpm --filter=@parqueavecino/api deploy --prod --legacy /out \
 && cp -r apps/api/src/generated /out/src-generated-unused 2>/dev/null || true

FROM node:24-slim AS runtime
ENV NODE_ENV=production
# OpenSSL: lo necesita el motor de migraciones de Prisma para conectarse por SSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Certificados de AWS RDS para validar el SSL de la base de datos (DATABASE_SSL=verify-full).
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem
COPY --from=build /out .
COPY apps/api/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && chmod 644 /app/certs/rds-global-bundle.pem
USER node
EXPOSE 3001
ENTRYPOINT ["/app/docker-entrypoint.sh"]
