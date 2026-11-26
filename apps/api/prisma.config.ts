import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// `prisma generate` no necesita la BD (p. ej. en CI); migrate/seed fallan con un error claro si falta.
const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  ...(url ? { datasource: { url } } : {}),
});
