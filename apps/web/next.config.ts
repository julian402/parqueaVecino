import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * La web llama a la API en el mismo origen (/api) para que las cookies de sesión sean de
 * primera parte. En local, Next reenvía /api a API_PROXY_URL; en AWS lo hace el balanceador.
 */
const apiProxyUrl = process.env.API_PROXY_URL;

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: incluir en la imagen los paquetes de la raíz.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  transpilePackages: ['@parqueavecino/ui'],
  async rewrites() {
    return apiProxyUrl ? [{ source: '/api/:path*', destination: `${apiProxyUrl}/api/:path*` }] : [];
  },
};

export default withNextIntl(nextConfig);
