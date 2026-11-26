import { Injectable } from '@nestjs/common';
import {
  PARKING_LOT_STATUSES,
  SearchSort,
  type AdminParkingLot,
  type AdminParkingLotListQuery,
  type Amenity,
  type ParkingLotInput,
  type ParkingLotStatus,
  type ParkingLotUpdate,
  type SearchResult,
  type Shift,
  type VehicleType,
} from '@parqueavecino/contracts';
import { PrismaService } from '../../../common/database/prisma.service';
import { Prisma } from '../../../generated/prisma/client';
import {
  ParkingLotsRepository,
  type LotSearchCriteria,
  type ParkingLotRecord,
  type ReservedOffer,
  type SpotTotals,
  type OfferWrite,
} from '../domain/parking-lots.repository';

/** Fila cruda de la consulta geoespacial. */
interface SearchRow {
  id: string;
  name: string;
  address: string;
  neighborhood: string | null;
  latitude: number;
  longitude: number;
  verified: boolean;
  amenities: Amenity[];
  distance_meters: number;
  shift: Shift;
  vehicle_type: VehicleType;
  available_spots: number;
  total_spots: number;
  monthly_price_minor: number;
  currency: string;
}

/** Punto geográfico (PostGIS) de un parqueadero, calculado desde latitud/longitud. */
const LOT_POINT = Prisma.sql`geography(ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326))`;

const include = {
  offers: { orderBy: [{ shift: 'asc' }, { vehicleType: 'asc' }] },
} satisfies Prisma.ParkingLotInclude;

type ParkingLotRow = Prisma.ParkingLotGetPayload<{ include: typeof include }>;

const adminInclude = {
  ...include,
  partner: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ParkingLotInclude;

type AdminParkingLotRow = Prisma.ParkingLotGetPayload<{ include: typeof adminInclude }>;

function toAdmin(row: AdminParkingLotRow): AdminParkingLot {
  const { partnerId: _partnerId, ...lot } = toRecord(row);
  return { ...lot, partner: row.partner, createdAt: row.createdAt.toISOString() };
}

function toRecord(row: ParkingLotRow): ParkingLotRecord {
  return {
    id: row.id,
    partnerId: row.partnerId,
    name: row.name,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    description: row.description,
    amenities: row.amenities,
    status: row.status,
    verified: row.verifiedAt !== null,
    offers: row.offers.map((offer) => ({
      id: offer.id,
      shift: offer.shift,
      vehicleType: offer.vehicleType,
      totalSpots: offer.totalSpots,
      availableSpots: offer.availableSpots,
      monthlyPriceMinor: offer.monthlyPriceMinor,
      currency: offer.currency,
      active: offer.active,
    })),
  };
}

@Injectable()
export class PrismaParkingLotsRepository extends ParkingLotsRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async search(criteria: LotSearchCriteria): Promise<SearchResult[]> {
    const center = Prisma.sql`geography(ST_SetSRID(ST_MakePoint(${criteria.longitude}, ${criteria.latitude}), 4326))`;
    // Llenos al final: se muestran ("Lleno" en el mapa) pero no compiten con los disponibles.
    const orderBy =
      criteria.sort === SearchSort.DISTANCE
        ? Prisma.sql`(o.available_spots = 0), distance_meters, o.monthly_price_minor`
        : Prisma.sql`(o.available_spots = 0), o.monthly_price_minor, distance_meters`;
    const maxPrice =
      criteria.maxPriceMinor === undefined
        ? Prisma.empty
        : Prisma.sql`AND o.monthly_price_minor <= ${criteria.maxPriceMinor}`;
    const amenities =
      criteria.amenities.length === 0
        ? Prisma.empty
        : Prisma.sql`AND p.amenities @> ARRAY[${Prisma.join(criteria.amenities)}]::"Amenity"[]`;

    const rows = await this.prisma.$queryRaw<SearchRow[]>`
      SELECT p.id, p.name, p.address, p.neighborhood, p.latitude, p.longitude,
             p.verified_at IS NOT NULL AS verified,
             p.amenities::text[] AS amenities,
             ROUND(ST_Distance(${LOT_POINT}, ${center}))::int AS distance_meters,
             o.shift::text AS shift, o.vehicle_type::text AS vehicle_type,
             o.available_spots, o.total_spots, o.monthly_price_minor, o.currency
      FROM parking_lots p
      JOIN offers o ON o.parking_lot_id = p.id
      WHERE p.status = 'ACTIVE'
        AND o.active
        AND o.shift = ${criteria.shift}::"Shift"
        AND o.vehicle_type = ${criteria.vehicleType}::"VehicleType"
        AND ST_DWithin(${LOT_POINT}, ${center}, ${criteria.radiusMeters})
        ${maxPrice}
        ${amenities}
      ORDER BY ${orderBy}
      LIMIT ${criteria.limit}
    `;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      neighborhood: row.neighborhood,
      latitude: row.latitude,
      longitude: row.longitude,
      verified: row.verified,
      amenities: row.amenities,
      distanceMeters: row.distance_meters,
      offer: {
        shift: row.shift,
        vehicleType: row.vehicle_type,
        availableSpots: row.available_spots,
        totalSpots: row.total_spots,
        monthlyPriceMinor: row.monthly_price_minor,
        currency: row.currency,
      },
    }));
  }

  async create(
    partnerId: string,
    input: ParkingLotInput,
    status: ParkingLotStatus,
  ): Promise<ParkingLotRecord> {
    const row = await this.prisma.parkingLot.create({
      data: { ...input, partnerId, status },
      include,
    });
    return toRecord(row);
  }

  async findById(id: string): Promise<ParkingLotRecord | null> {
    const row = await this.prisma.parkingLot.findUnique({ where: { id }, include });
    return row ? toRecord(row) : null;
  }

  async listByPartner(partnerId: string): Promise<ParkingLotRecord[]> {
    const rows = await this.prisma.parkingLot.findMany({
      where: { partnerId },
      include,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toRecord);
  }

  async update(id: string, input: ParkingLotUpdate): Promise<ParkingLotRecord> {
    const row = await this.prisma.parkingLot.update({ where: { id }, data: input, include });
    return toRecord(row);
  }

  async upsertOffers(
    parkingLotId: string,
    offers: OfferWrite[],
    currency: string,
  ): Promise<ParkingLotRecord> {
    await this.prisma.$transaction(
      offers.map((offer) =>
        this.prisma.offer.upsert({
          where: {
            parkingLotId_shift_vehicleType: {
              parkingLotId,
              shift: offer.shift,
              vehicleType: offer.vehicleType,
            },
          },
          create: { ...offer, parkingLotId, currency },
          update: { ...offer, currency },
        }),
      ),
    );
    const row = await this.prisma.parkingLot.findUniqueOrThrow({
      where: { id: parkingLotId },
      include,
    });
    return toRecord(row);
  }

  async listForAdmin({
    page,
    pageSize,
    q,
    status,
  }: AdminParkingLotListQuery): Promise<{ items: AdminParkingLot[]; total: number }> {
    const where: Prisma.ParkingLotWhereInput = {
      status,
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { address: { contains: q, mode: 'insensitive' } },
          { neighborhood: { contains: q, mode: 'insensitive' } },
          { partner: { fullName: { contains: q, mode: 'insensitive' } } },
        ],
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.parkingLot.findMany({
        where,
        include: adminInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.parkingLot.count({ where }),
    ]);
    return { items: rows.map(toAdmin), total };
  }

  async findForAdmin(id: string): Promise<AdminParkingLot | null> {
    const row = await this.prisma.parkingLot.findUnique({ where: { id }, include: adminInclude });
    return row ? toAdmin(row) : null;
  }

  async setStatus(id: string, status: ParkingLotStatus, verifiedAt?: Date | null): Promise<void> {
    await this.prisma.parkingLot.update({
      where: { id },
      data: { status, ...(verifiedAt !== undefined && { verifiedAt }) },
    });
  }

  async countByStatus(): Promise<Record<ParkingLotStatus, number>> {
    const rows = await this.prisma.parkingLot.groupBy({ by: ['status'], _count: { _all: true } });
    const counts = Object.fromEntries(PARKING_LOT_STATUSES.map((s) => [s, 0])) as Record<
      ParkingLotStatus,
      number
    >;
    for (const row of rows) counts[row.status] = row._count._all;
    return counts;
  }

  async spotTotals(partnerId?: string): Promise<SpotTotals> {
    const lotWhere: Prisma.ParkingLotWhereInput = partnerId ? { partnerId } : {};
    const [lots, sums] = await this.prisma.$transaction([
      this.prisma.parkingLot.count({ where: lotWhere }),
      this.prisma.offer.aggregate({
        where: { active: true, parkingLot: lotWhere },
        _sum: { totalSpots: true, availableSpots: true },
      }),
    ]);
    return {
      lots,
      totalSpots: sums._sum.totalSpots ?? 0,
      availableSpots: sums._sum.availableSpots ?? 0,
    };
  }

  async findOffer(offerId: string): Promise<(ReservedOffer & { available: boolean }) | null> {
    const offer = await this.prisma.offer.findUnique({
      where: { id: offerId },
      include: { parkingLot: { select: { status: true } } },
    });
    if (!offer) return null;
    return {
      offerId: offer.id,
      parkingLotId: offer.parkingLotId,
      shift: offer.shift,
      vehicleType: offer.vehicleType,
      monthlyPriceMinor: offer.monthlyPriceMinor,
      currency: offer.currency,
      available: offer.active && offer.parkingLot.status === 'ACTIVE',
    };
  }

  async reserveSpot(offerId: string): Promise<ReservedOffer | null> {
    // UPDATE condicionado: dos compras simultáneas del último cupo no pueden ganar ambas.
    const { count } = await this.prisma.offer.updateMany({
      where: {
        id: offerId,
        active: true,
        availableSpots: { gt: 0 },
        parkingLot: { status: 'ACTIVE' },
      },
      data: { availableSpots: { decrement: 1 } },
    });
    if (count === 0) return null;
    const offer = await this.prisma.offer.findUniqueOrThrow({ where: { id: offerId } });
    return {
      offerId: offer.id,
      parkingLotId: offer.parkingLotId,
      shift: offer.shift,
      vehicleType: offer.vehicleType,
      monthlyPriceMinor: offer.monthlyPriceMinor,
      currency: offer.currency,
    };
  }

  async releaseSpot(offerId: string): Promise<void> {
    // Nunca supera el total (por si el aliado redujo cupos mientras tanto).
    await this.prisma.$executeRaw`
      UPDATE offers SET available_spots = LEAST(available_spots + 1, total_spots)
      WHERE id = ${offerId}::uuid
    `;
  }
}
