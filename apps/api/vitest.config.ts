import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC compila los decoradores de NestJS (emitDecoratorMetadata) que esbuild no soporta.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
