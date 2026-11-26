import 'dotenv/config';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Pruebas contra una base de datos real y separada (TEST_DATABASE_URL).
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error('Define TEST_DATABASE_URL para las pruebas e2e');

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    environment: 'node',
    include: ['test/e2e/**/*.e2e.ts'],
    globalSetup: ['test/e2e/global-setup.ts'],
    env: { DATABASE_URL: testDatabaseUrl, LOG_LEVEL: 'error' },
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
