import { next } from '@parqueavecino/config/eslint/next';

export default [
  // Código generado (Orval), worker de MapLibre copiado y scripts de Node fuera del tsconfig.
  { ignores: ['src/lib/api/generated/**', 'public/vendor/**', 'scripts/**'] },
  ...next(import.meta.dirname),
];
