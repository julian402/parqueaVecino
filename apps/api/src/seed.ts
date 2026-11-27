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
import { hash, verify } from 'argon2';
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
  'booking.paymentHoldMinutes': {
    value: 30,
    description: 'Minutos que un cupo queda apartado mientras el conductor paga',
  },
  'search.defaultRadiusMeters': {
    value: 1500,
    description: 'Radio de búsqueda por defecto',
  },
  'search.defaultCenter': {
    value: { label: 'Chapinero, Bogotá', latitude: 4.6486, longitude: -74.0631 },
    description: 'Punto inicial del mapa y sesgo del geocodificador',
  },
  'search.priceFiltersMinor': {
    value: {
      CAR: [money(150_000), money(200_000), money(250_000)],
      MOTORCYCLE: [money(80_000), money(100_000), money(120_000)],
      BICYCLE: [money(30_000), money(40_000), money(50_000)],
    },
    description: 'Opciones del filtro "Hasta $X" por tipo de vehículo',
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
  // Las cuentas del seed siempre usan la contraseña del entorno (en AWS, del secreto): si el
  // secreto cambia, se actualiza aquí en el siguiente arranque.
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing && !(await verify(existing.passwordHash, data.password))) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: await hash(data.password) },
    });
  }
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

type DemoOffer = {
  shift: 'DAY' | 'NIGHT' | 'FULL';
  vehicle?: 'CAR' | 'MOTORCYCLE' | 'BICYCLE';
  total: number;
  free: number;
  price: number;
};
type DemoLot = {
  name: string;
  address: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  description?: string;
  amenities: ('ROOF' | 'SECURITY_24H' | 'CAMERAS' | 'BIKE_SPOT' | 'EV_CHARGER')[];
  offers: DemoOffer[];
};

/** Ilustración ficticia de cada parqueadero demo (apps/web/public/demo/parqueaderos). */
const demoPhoto = (index: number) =>
  `/demo/parqueaderos/${String(index + 1).padStart(2, '0')}.webp`;

/** Parqueaderos de demostración con ubicaciones reales de Bogotá (datos ficticios). */
const demoLots: DemoLot[] = [
  {
    name: 'Parqueadero Calle 63',
    address: 'Cra 13 # 63-21',
    neighborhood: 'Chapinero',
    latitude: 4.6486,
    longitude: -74.0631,
    description: 'Cubierto, a media cuadra de la Caracas. Ingreso con código QR.',
    amenities: ['ROOF', 'SECURITY_24H', 'CAMERAS', 'BIKE_SPOT'],
    offers: [
      { shift: 'NIGHT', total: 40, free: 5, price: 170_000 },
      { shift: 'DAY', total: 40, free: 2, price: 190_000 },
      { shift: 'FULL', total: 10, free: 1, price: 340_000 },
      { shift: 'NIGHT', vehicle: 'MOTORCYCLE', total: 15, free: 6, price: 85_000 },
      { shift: 'DAY', vehicle: 'BICYCLE', total: 20, free: 12, price: 35_000 },
    ],
  },
  {
    name: 'Parking Cra 13',
    address: 'Cra 13 # 57-40',
    neighborhood: 'Chapinero',
    latitude: 4.6425,
    longitude: -74.0655,
    amenities: ['SECURITY_24H', 'CAMERAS'],
    offers: [
      { shift: 'NIGHT', total: 25, free: 2, price: 190_000 },
      { shift: 'DAY', total: 25, free: 0, price: 210_000 },
      { shift: 'FULL', total: 8, free: 2, price: 360_000 },
    ],
  },
  {
    name: 'Estacionamiento Lourdes',
    address: 'Calle 63 # 9-15',
    neighborhood: 'Chapinero',
    latitude: 4.6497,
    longitude: -74.0598,
    amenities: ['ROOF', 'SECURITY_24H'],
    offers: [
      { shift: 'NIGHT', total: 30, free: 7, price: 160_000 },
      { shift: 'DAY', total: 30, free: 3, price: 180_000 },
    ],
  },
  {
    name: 'Parqueadero Chapinero Central',
    address: 'Cra 11 # 60-15',
    neighborhood: 'Chapinero',
    latitude: 4.6462,
    longitude: -74.0641,
    amenities: ['CAMERAS'],
    offers: [
      { shift: 'NIGHT', total: 20, free: 0, price: 175_000 },
      { shift: 'DAY', total: 20, free: 0, price: 195_000 },
    ],
  },
  {
    name: 'Parqueadero Zona G',
    address: 'Calle 69 # 5-40',
    neighborhood: 'Chapinero Alto',
    latitude: 4.6556,
    longitude: -74.0567,
    description: 'Ideal para quienes trabajan en la Zona G. Valet en horario diurno.',
    amenities: ['ROOF', 'SECURITY_24H', 'CAMERAS', 'EV_CHARGER'],
    offers: [
      { shift: 'DAY', total: 30, free: 6, price: 230_000 },
      { shift: 'NIGHT', total: 30, free: 9, price: 180_000 },
      { shift: 'FULL', total: 10, free: 3, price: 390_000 },
    ],
  },
  {
    name: 'Park Quinta Camacho',
    address: 'Cra 9 # 70-12',
    neighborhood: 'Quinta Camacho',
    latitude: 4.6582,
    longitude: -74.0591,
    amenities: ['ROOF', 'CAMERAS', 'BIKE_SPOT'],
    offers: [
      { shift: 'DAY', total: 18, free: 4, price: 200_000 },
      { shift: 'NIGHT', total: 18, free: 10, price: 150_000 },
      { shift: 'DAY', vehicle: 'MOTORCYCLE', total: 10, free: 3, price: 95_000 },
      { shift: 'NIGHT', vehicle: 'BICYCLE', total: 15, free: 9, price: 30_000 },
    ],
  },
  {
    name: 'Parqueadero Marly',
    address: 'Calle 50 # 13-30',
    neighborhood: 'Marly',
    latitude: 4.6371,
    longitude: -74.0671,
    amenities: ['SECURITY_24H'],
    offers: [
      { shift: 'DAY', total: 35, free: 11, price: 170_000 },
      { shift: 'NIGHT', total: 35, free: 14, price: 140_000 },
      { shift: 'NIGHT', vehicle: 'MOTORCYCLE', total: 20, free: 8, price: 75_000 },
    ],
  },
  {
    name: 'Estacionamiento Javeriana',
    address: 'Cra 7 # 45-20',
    neighborhood: 'Chapinero',
    latitude: 4.6293,
    longitude: -74.0646,
    description: 'Frente a la universidad. Muy buscado por estudiantes y docentes de día.',
    amenities: ['ROOF', 'CAMERAS', 'BIKE_SPOT'],
    offers: [
      { shift: 'DAY', total: 50, free: 1, price: 210_000 },
      { shift: 'NIGHT', total: 50, free: 22, price: 130_000 },
      { shift: 'DAY', vehicle: 'BICYCLE', total: 40, free: 15, price: 40_000 },
    ],
  },
  {
    name: 'Parqueadero Galerías',
    address: 'Calle 53 # 24-10',
    neighborhood: 'Galerías',
    latitude: 4.6438,
    longitude: -74.0762,
    amenities: ['SECURITY_24H', 'CAMERAS'],
    offers: [
      { shift: 'DAY', total: 28, free: 7, price: 160_000 },
      { shift: 'NIGHT', total: 28, free: 12, price: 135_000 },
      { shift: 'FULL', total: 6, free: 2, price: 290_000 },
    ],
  },
  {
    name: 'Estacionamiento Teusaquillo',
    address: 'Calle 39 # 20-30',
    neighborhood: 'Teusaquillo',
    latitude: 4.6281,
    longitude: -74.0718,
    amenities: ['ROOF', 'BIKE_SPOT'],
    offers: [
      { shift: 'NIGHT', total: 22, free: 5, price: 145_000 },
      { shift: 'NIGHT', vehicle: 'BICYCLE', total: 25, free: 20, price: 30_000 },
    ],
  },
  {
    name: 'Parking Zona Rosa',
    address: 'Calle 82 # 13-15',
    neighborhood: 'El Retiro',
    latitude: 4.6667,
    longitude: -74.0539,
    amenities: ['ROOF', 'SECURITY_24H', 'CAMERAS', 'EV_CHARGER'],
    offers: [
      { shift: 'DAY', total: 60, free: 8, price: 260_000 },
      { shift: 'NIGHT', total: 60, free: 15, price: 210_000 },
      { shift: 'FULL', total: 15, free: 4, price: 420_000 },
    ],
  },
  {
    name: 'Parqueadero Parque 93',
    address: 'Calle 93 # 13-40',
    neighborhood: 'Chicó',
    latitude: 4.6766,
    longitude: -74.0486,
    amenities: ['ROOF', 'SECURITY_24H', 'CAMERAS'],
    offers: [
      { shift: 'DAY', total: 45, free: 5, price: 280_000 },
      { shift: 'NIGHT', total: 45, free: 18, price: 220_000 },
      { shift: 'DAY', vehicle: 'MOTORCYCLE', total: 15, free: 5, price: 110_000 },
    ],
  },
  {
    name: 'Biciparqueadero Calle 57',
    address: 'Calle 57 # 9-20',
    neighborhood: 'Chapinero',
    latitude: 4.6421,
    longitude: -74.0619,
    description: 'Solo bicicletas y patinetas. Con lockers y ducha para ciclistas.',
    amenities: ['ROOF', 'SECURITY_24H', 'BIKE_SPOT'],
    offers: [
      { shift: 'DAY', vehicle: 'BICYCLE', total: 60, free: 25, price: 45_000 },
      { shift: 'NIGHT', vehicle: 'BICYCLE', total: 60, free: 40, price: 30_000 },
      { shift: 'FULL', vehicle: 'BICYCLE', total: 20, free: 8, price: 60_000 },
    ],
  },
];

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

  for (const [index, lot] of demoLots.entries()) {
    const photos = [demoPhoto(index)];
    const found = await prisma.parkingLot.findFirst({
      where: { partnerId: partner.id, name: lot.name },
    });
    // Los ya creados (p. ej. en AWS) reciben la ilustración si aún no tienen fotos.
    const existing =
      found && found.photos.length === 0
        ? await prisma.parkingLot.update({ where: { id: found.id }, data: { photos } })
        : found;
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
          description: lot.description,
          amenities: lot.amenities,
          photos,
          status: 'ACTIVE',
          verifiedAt: new Date(),
        },
      }));

    for (const offer of lot.offers) {
      const vehicleType = offer.vehicle ?? 'CAR';
      await prisma.offer.upsert({
        where: {
          parkingLotId_shift_vehicleType: {
            parkingLotId: parkingLot.id,
            shift: offer.shift,
            vehicleType,
          },
        },
        create: {
          parkingLotId: parkingLot.id,
          shift: offer.shift,
          vehicleType,
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
