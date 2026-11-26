import { next } from '@parqueavecino/config/eslint/next';

export default [{ ignores: ['src/lib/api/generated/**'] }, ...next(import.meta.dirname)];
