#!/bin/sh
# Apunta el dominio de DuckDNS a la IP pública de esta tarea y arranca Caddy.
# Fargate no admite IP fija: cada tarea nueva actualiza el registro al arrancar.
# ECS solo inicia este contenedor cuando la web y la API ya están sanas.
set -eu

if [ -n "${DUCKDNS_SUBDOMAIN:-}" ] && [ -n "${DUCKDNS_TOKEN:-}" ]; then
  attempt=1
  while [ "$attempt" -le 5 ]; do
    # ip vacío: DuckDNS usa la IP de origen de la petición, es decir, la IP pública de la tarea.
    result=$(wget -qO- "https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=" || true)
    if [ "$result" = "OK" ]; then
      echo "DuckDNS: ${DUCKDNS_SUBDOMAIN}.duckdns.org apunta a esta tarea"
      break
    fi
    echo "DuckDNS respondió '${result}' (intento ${attempt}/5); revisa el token en Secrets Manager"
    attempt=$((attempt + 1))
    sleep 5
  done
else
  echo "DuckDNS: sin subdominio o token; no se actualiza la IP"
fi

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
