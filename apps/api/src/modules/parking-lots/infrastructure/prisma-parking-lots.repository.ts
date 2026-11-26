import { Injectable } from '@nestjs/common';
import {
  SearchSort,
  type Amenity,
  type OfferInput,
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
    offers: OfferInput[],
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
}
