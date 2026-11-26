import { defineConfig } from 'orval';

/**
 * Genera hooks de TanStack Query tipados desde el contrato OpenAPI de la API.
 * Regenerar tras cambiar endpoints: pnpm --filter @parqueavecino/api openapi && pnpm --filter @parqueavecino/web api:generate
 */
export default defineConfig({
  parqueavecino: {
    input: { target: '../api/openapi.json' },
    output: {
      target: 'src/lib/api/generated/endpoints.ts',
      schemas: 'src/lib/api/generated/model',
      client: 'react-query',
      httpClient: 'fetch',
      mode: 'tags-split',
      clean: true,
      override: {
        mutator: { path: 'src/lib/api/http.ts', name: 'http' },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
