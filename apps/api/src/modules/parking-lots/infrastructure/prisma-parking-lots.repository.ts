import { Injectable } from '@nestjs/common';
import type {
  OfferInput,
  ParkingLotInput,
  ParkingLotStatus,
  ParkingLotUpdate,
} from '@parqueavecino/contracts';
import { PrismaService } from '../../../common/database/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import { ParkingLotsRepository, type ParkingLotRecord } from '../domain/parking-lots.repository';

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
