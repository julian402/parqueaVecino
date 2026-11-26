// Copia el worker de MapLibre a public/ para servirlo como archivo estático.
// MapLibre lo busca junto a su propio módulo (import.meta.url), cosa que el bundler de Next
// no resuelve; por eso la web lo registra con setWorkerUrl (ver features/map).
// Se ejecuta antes de `dev` y `build`, así siempre coincide con la versión instalada.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = join(
  dirname(require.resolve('maplibre-gl/package.json')),
  'dist',
  'maplibre-gl-worker.mjs',
);
const targetDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'vendor');

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, 'maplibre-gl-worker.mjs'));
