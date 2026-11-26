# Proxy de entrada (Caddy) con actualización de IP en DuckDNS.
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 80 443
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
