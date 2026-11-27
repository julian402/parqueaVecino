# Imagen de la web (Next.js standalone). Contexto de build: raíz del repositorio.
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH HUSKY=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Next incrusta las variables NEXT_PUBLIC_* al compilar: llegan como build args (infra/config).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_LOCALE
ARG NEXT_PUBLIC_APP_TIMEZONE
ARG NEXT_PUBLIC_APP_CURRENCY
ARG NEXT_PUBLIC_MAP_STYLE_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_APP_LOCALE=$NEXT_PUBLIC_APP_LOCALE \
    NEXT_PUBLIC_APP_TIMEZONE=$NEXT_PUBLIC_APP_TIMEZONE \
    NEXT_PUBLIC_APP_CURRENCY=$NEXT_PUBLIC_APP_CURRENCY \
    NEXT_PUBLIC_MAP_STYLE_URL=$NEXT_PUBLIC_MAP_STYLE_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@parqueavecino/web

FROM node:24-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
# El modo standalone no incluye public/ (logo, worker del mapa): se copia aparte.
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
