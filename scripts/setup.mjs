#!/usr/bin/env node
/**
 * Deja el proyecto listo en un equipo nuevo, sin versionar nada local:
 *   1. Crea los .env desde los .env.example (si no existen).
 *   2. Crea CLAUDE.md y .claude/settings.json desde tooling/claude (si no existen).
 *   3. Levanta Docker (PostgreSQL + PostGIS, Valkey, S3Mock, Mailpit).
 *   4. Genera el cliente de Prisma, aplica migraciones y carga datos demo.
 * Es idempotente: se puede correr las veces que se quiera.
 */
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (path) => join(root, path);

const copies = [
  ['apps/api/.env.example', 'apps/api/.env'],
  ['apps/web/.env.example', 'apps/web/.env.local'],
  ['tooling/claude/CLAUDE.md', 'CLAUDE.md'],
  ['tooling/claude/settings.json', '.claude/settings.json'],
];

function step(title, command, cwd = root) {
  console.log(`\n▶ ${title}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

console.log('▶ Archivos locales');
for (const [from, to] of copies) {
  if (existsSync(at(to))) {
    console.log(`  = ${to} (ya existe, no se toca)`);
    continue;
  }
  mkdirSync(dirname(at(to)), { recursive: true });
  copyFileSync(at(from), at(to));
  console.log(`  + ${to}`);
}

step('Servicios locales (Docker)', 'docker compose -f docker/docker-compose.yml up -d --wait');
step('Cliente de Prisma', 'pnpm --filter @parqueavecino/api generate');
step('Paquetes compartidos', 'pnpm turbo run build --filter=@parqueavecino/api^...');
step('Migraciones', 'pnpm --filter @parqueavecino/api db:deploy');
step('Datos iniciales y demo', 'pnpm --filter @parqueavecino/api db:seed');

console.log('\n✔ Listo. Corre `pnpm dev` y abre http://localhost:3000');
console.log('  Usuarios demo y contraseñas: ver apps/api/.env (SEED_*).');
