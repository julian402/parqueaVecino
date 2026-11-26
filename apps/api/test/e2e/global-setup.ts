import 'dotenv/config';
import { execSync } from 'node:child_process';
import { Client } from 'pg';

/**
 * Prepara la base de pruebas: la crea si no existe, aplica migraciones,
 * la deja vacía y carga los parámetros de negocio (sin datos demo).
 */
export default async function globalSetup(): Promise<void> {
  const url = new URL(process.env.TEST_DATABASE_URL ?? '');
  const database = url.pathname.slice(1);

  const admin = new URL(url);
  admin.pathname = '/postgres';
  admin.search = '';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    database,
  ]);
  if (!rowCount) await client.query(`CREATE DATABASE "${database}"`);
  await client.end();

  const env = { ...process.env, DATABASE_URL: url.toString(), SEED_DEMO_DATA: 'false' };
  execSync('pnpm exec prisma migrate deploy', { env, stdio: 'ignore' });

  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  await db.query('TRUNCATE users, system_settings RESTART IDENTITY CASCADE');
  await db.end();

  execSync('pnpm exec prisma db seed', { env, stdio: 'ignore' });
}
