#!/bin/sh
# Arranque del contenedor de la API.
# En AWS las credenciales de la BD llegan por separado (Secrets Manager) y aquí se arma la URL.
set -e

if [ -z "$DATABASE_URL" ] && [ -n "$DB_HOST" ]; then
  SSL_MODE="require"
  [ "${DATABASE_SSL:-disable}" = "disable" ] && SSL_MODE="disable"
  export DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&sslmode=${SSL_MODE}"
fi

if [ "$RUN_MIGRATIONS_ON_START" = "true" ]; then
  echo "Aplicando migraciones..."
  ./node_modules/.bin/prisma migrate deploy
fi

if [ "$RUN_SEED_ON_START" = "true" ]; then
  echo "Ejecutando seed..."
  node dist/seed.js
fi

exec node dist/main.js
