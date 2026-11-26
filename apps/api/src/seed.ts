/**
 * Seed idempotente: se puede ejecutar varias veces sin duplicar datos.
 *  - Siempre: parámetros de negocio (system_settings) y el usuario administrador.
 *  - Si SEED_DEMO_DATA=true: aliado, conductor y parqueaderos de demostración (Chapinero).
 * Contraseñas y correos vienen de variables de entorno, nunca del código.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { settingsSchemas, type SettingKey, type SettingValue } from '@parqueavecino/contracts';
import { toMinorUnits } from '@parqueavecino/utils';
import { hash } from 'argon2';
import { z } from 'zod';
import { buildPoolConfig } from './common/database/prisma.service';
import { PrismaClient } from './generated/prisma/client';

const env = z
  .object({
    DATABASE_URL: z.url(),
    DATABASE_SSL: z.enum(['disable', 'require', 'verify-full']).default('disable'),
    DATABASE_SSL_CA_FILE: z.string().optional(),
    APP_CURRENCY: z.string().length(3),
    SEED_ADMIN_EMAIL: z.email(),
    SEED_ADMIN_PASSWORD: z.string().min(8),
    SEED_DEMO_DATA: z.enum(['true', 'false']).default('false'),
    SEED_DEMO_PASSWORD: z.string().min(8).optional(),
  })
  .parse(process.env);

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    buildPoolConfig({
      url: env.DATABASE_URL,
      sslMode: env.DATABASE_SSL,
      caFile: env.DATABASE_SSL_CA_FILE,
    }),
  ),
});
const money = (amount: number) => toMinorUnits(amount, env.APP_CURRENCY);

/** Valores iniciales; luego se editan en la BD sin tocar código. */
const defaultSettings: { [K in SettingKey]: { value: SettingValue<K>; description: string } } = {
  'commission.basisPoints': {
    value: 1000,
    description: 'Comisión al parqueadero por mes activo, en puntos básicos (1000 = 10 %)',
  },
  'shift.schedule': {
    value: {
      DAY: { start: '06:00', end: '18:00' },
      NIGHT: { start: '18:00', end: '06:00' },
      FULL: { start: '00:00', end: '24:00' },
    },
    description: 'Horario de cada franja de mensualidad',
  },
  'pricing.monthlyCapMinor': {
    // Valores provisionales: validar contra el Decreto 098 de 2024 antes de la demo.
    value: { CAR: money(400_000), MOTORCYCLE: money(150_000), BICYCLE: money(60_000) },
    description: 'Tope de precio mensual por tipo de vehículo (Decreto 098 de 2024)',
  },
  'booking.freeCancellationHours': {
    value: 24,
    description: 'Horas antes del inicio en que la cancelación es gratuita',
  },
  'search.defaultRadiusMeters': {
    value: 1500,
    description: 'Radio de búsqueda por defecto',
  },
};

async function seedSettings() {
  for (const key of Object.keys(defaultSettings) as SettingKey[]) {
    const { value, description } = defaultSettings[key];
    const parsed: unknown = settingsSchemas[key].parse(value);
    // No sobrescribe valores ya editados: solo crea los que faltan.
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: parsed as object, description },
      update: { description },
    });
  }
}

async function upsertUser(data: {
  email: string;
  password: string;
  fullName: string;
  role: 'ADMIN' | 'PARTNER' | 'DRIVER';
  phone?: string;
}) {
  return prisma.user.upsert({
    where: { email: data.email },
    create: {
      email: data.email,
      passwordHash: await hash(data.password),
      fullName: data.fullName,
      role: data.role,
      phone: data.phone,
    },
    update: {},
  });
}

const demoLots = [
  {
    name: 'Parqueadero Calle 63',
    address: 'Cra 13 # 63-21',
    neighborhood: 'Chapinero',
    latitude: 4.6486,
    longitude: -74.0631,
    amenities: ['ROOF', 'SECURITY_24H', 'CAMERAS', 'BIKE_SPOT'] as const,
    offers: [
      { shift: 'NIGHT', total: 40, free: 5, price: 170_000 },
      { shift: 'DAY', total: 40, free: 2, price: 190_000 },
      { shift: 'FULL', total: 10, free: 1, price: 340_000 },
    ],
  },
  {
    name: 'Parking Cra 13',
    address: 'Cra 13 # 57-40',
    neighborhood: 'Chapinero',
    latitude: 4.6425,
    longitude: -74.0655,
    amenities: ['SECURITY_24H', 'CAMERAS'] as const,
    offers: [
      { shift: 'NIGHT', total: 25, free: 2, price: 190_000 },
      { shift: 'DAY', total: 25, free: 0, price: 210_000 },
    ],
  },
  {
    name: 'Estacionamiento Lourdes',
    address: 'Calle 63 # 9-15',
    neighborhood: 'Chapinero',
    latitude: 4.6497,
    longitude: -74.0598,
    amenities: ['ROOF', 'SECURITY_24H'] as const,
    offers: [{ shift: 'NIGHT', total: 30, free: 7, price: 160_000 }],
  },
] as const;

async function seedDemo(password: string) {
  const partner = await upsertUser({
    email: 'aliado.demo@parqueavecino.local',
    password,
    fullName: 'Aliado Demo',
    role: 'PARTNER',
  });
  await upsertUser({
    email: 'conductor.demo@parqueavecino.local',
    password,
    fullName: 'Conductor Demo',
    role: 'DRIVER',
  });

  for (const lot of demoLots) {
    const existing = await prisma.parkingLot.findFirst({
      where: { partnerId: partner.id, name: lot.name },
    });
    const parkingLot =
      existing ??
      (await prisma.parkingLot.create({
        data: {
          partnerId: partner.id,
          name: lot.name,
          address: lot.address,
          neighborhood: lot.neighborhood,
          city: 'Bogotá',
          latitude: lot.latitude,
          longitude: lot.longitude,
          amenities: [...lot.amenities],
          status: 'ACTIVE',
          verifiedAt: new Date(),
        },
      }));

    for (const offer of lot.offers) {
      await prisma.offer.upsert({
        where: {
          parkingLotId_shift_vehicleType: {
            parkingLotId: parkingLot.id,
            shift: offer.shift,
            vehicleType: 'CAR',
          },
        },
        create: {
          parkingLotId: parkingLot.id,
          shift: offer.shift,
          vehicleType: 'CAR',
          totalSpots: offer.total,
          availableSpots: offer.free,
          monthlyPriceMinor: money(offer.price),
          currency: env.APP_CURRENCY,
        },
        update: {},
      });
    }
  }
}

async function main() {
  await seedSettings();
  await upsertUser({
    email: env.SEED_ADMIN_EMAIL,
    password: env.SEED_ADMIN_PASSWORD,
    fullName: 'Administrador',
    role: 'ADMIN',
  });

  if (env.SEED_DEMO_DATA === 'true') {
    if (!env.SEED_DEMO_PASSWORD)
      throw new Error('SEED_DEMO_PASSWORD es obligatorio con datos demo');
    await seedDemo(env.SEED_DEMO_PASSWORD);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    process.stderr.write(`Seed falló: ${String(error)}\n`);
    await prisma.$disconnect();
    process.exit(1);
  });
