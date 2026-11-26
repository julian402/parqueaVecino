import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ParkingLotStatus,
  type AdminParkingLot,
  type AdminParkingLotListQuery,
  type AdminParkingLotPage,
  type AdminParkingLotReviewInput,
  type OfferInput,
  type ParkingLot,
  type PartnerLotStatusInput,
  type ParkingLotInput,
  type ParkingLotUpdate,
} from '@parqueavecino/contracts';
import { AppConfigService } from '../../../config/app-config.service';
import { SettingsService } from '../../settings/application/settings.service';
import {
  ParkingLotsRepository,
  type ParkingLotRecord,
  type ReservedOffer,
  type SpotTotals,
} from '../domain/parking-lots.repository';

const NOT_FOUND = 'Parqueadero no encontrado';

function toPublic({ partnerId: _partnerId, ...lot }: ParkingLotRecord): ParkingLot {
  return lot;
}

@Injectable()
export class ParkingLotsService {
  constructor(
    private readonly repository: ParkingLotsRepository,
    private readonly settings: SettingsService,
    private readonly config: AppConfigService,
  ) {}

  /** Un parqueadero nuevo queda pendiente de verificación (póliza, RUT...) antes de publicarse. */
  async createForPartner(partnerId: string, input: ParkingLotInput): Promise<ParkingLot> {
    const lot = await this.repository.create(
      partnerId,
      input,
      ParkingLotStatus.PENDING_VERIFICATION,
    );
    return toPublic(lot);
  }

  async listForPartner(partnerId: string): Promise<ParkingLot[]> {
    return (await this.repository.listByPartner(partnerId)).map(toPublic);
  }

  async updateForPartner(
    partnerId: string,
    id: string,
    input: ParkingLotUpdate,
  ): Promise<ParkingLot> {
    await this.getOwned(partnerId, id);
    return toPublic(await this.repository.update(id, input));
  }

  /** Vista pública: solo parqueaderos activos. */
  async getPublic(id: string): Promise<ParkingLot> {
    const lot = await this.repository.findById(id);
    if (!lot || lot.status !== ParkingLotStatus.ACTIVE) throw new NotFoundException(NOT_FOUND);
    return toPublic(lot);
  }

  /**
   * Crea o actualiza cupos por franja. Los libres se recalculan conservando lo ya vendido:
   * no se puede bajar el total por debajo de las mensualidades vigentes.
   */
  async upsertOffers(partnerId: string, id: string, offers: OfferInput[]): Promise<ParkingLot> {
    const lot = await this.getOwned(partnerId, id);
    await this.assertWithinPriceCap(offers);
    const writes = offers.map((offer) => {
      const current = lot.offers.find(
        (o) => o.shift === offer.shift && o.vehicleType === offer.vehicleType,
      );
      const sold = current ? current.totalSpots - current.availableSpots : 0;
      if (offer.totalSpots < sold) {
        throw new ConflictException(
          `No puedes dejar menos de ${sold} cupos: ya están vendidos como mensualidades vigentes`,
        );
      }
      return { ...offer, availableSpots: offer.totalSpots - sold };
    });
    const updated = await this.repository.upsertOffers(id, writes, this.config.get('APP_CURRENCY'));
    return toPublic(updated);
  }

  /** El aliado pausa o reanuda un parqueadero publicado (no puede autoaprobarse). */
  async setStatusForPartner(
    partnerId: string,
    id: string,
    status: PartnerLotStatusInput['status'],
  ): Promise<ParkingLot> {
    const lot = await this.getOwned(partnerId, id);
    const pausable: ParkingLotStatus[] = [ParkingLotStatus.ACTIVE, ParkingLotStatus.PAUSED];
    if (!pausable.includes(lot.status)) {
      throw new ConflictException('Solo puedes pausar o reanudar un parqueadero ya aprobado');
    }
    if (lot.status !== status) await this.repository.setStatus(id, status);
    return this.getForPartner(partnerId, id);
  }

  async getForPartner(partnerId: string, id: string): Promise<ParkingLot> {
    return toPublic(await this.getOwned(partnerId, id));
  }

  // ---------- Panel del admin ----------

  async listForAdmin(query: AdminParkingLotListQuery): Promise<AdminParkingLotPage> {
    const { items, total } = await this.repository.listForAdmin(query);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Aprobar, suspender o devolver a verificación. Aprobar (ACTIVE) marca el parqueadero como
   * verificado salvo que se indique lo contrario; `verified: false` quita el sello.
   */
  async review(id: string, input: AdminParkingLotReviewInput): Promise<AdminParkingLot> {
    const lot = await this.repository.findById(id);
    if (!lot) throw new NotFoundException(NOT_FOUND);
    const verified =
      input.verified ?? (input.status === ParkingLotStatus.ACTIVE ? true : undefined);
    const verifiedAt =
      verified === undefined
        ? undefined
        : verified
          ? lot.verified
            ? undefined
            : new Date()
          : null;
    await this.repository.setStatus(id, input.status, verifiedAt);
    const updated = await this.repository.findForAdmin(id);
    if (!updated) throw new NotFoundException(NOT_FOUND);
    return updated;
  }

  countByStatus(): Promise<Record<ParkingLotStatus, number>> {
    return this.repository.countByStatus();
  }

  spotTotals(partnerId?: string): Promise<SpotTotals> {
    return this.repository.spotTotals(partnerId);
  }

  // ---------- Reservas (los usa el módulo bookings) ----------

  /** Precio vigente de una oferta; 409 si ya no se vende (renovaciones). */
  async getSellableOffer(offerId: string): Promise<ReservedOffer> {
    const offer = await this.repository.findOffer(offerId);
    if (!offer?.available) {
      throw new ConflictException('El parqueadero ya no ofrece esta franja');
    }
    const { available: _available, ...rest } = offer;
    return rest;
  }

  async reserveSpot(offerId: string): Promise<ReservedOffer> {
    const offer = await this.repository.reserveSpot(offerId);
    if (!offer) throw new ConflictException('Ya no quedan cupos disponibles en esta franja');
    return offer;
  }

  releaseSpot(offerId: string): Promise<void> {
    return this.repository.releaseSpot(offerId);
  }

  /** Tope tarifario (Decreto 098 de 2024), leído de system_settings. */
  private async assertWithinPriceCap(offers: OfferInput[]): Promise<void> {
    const caps = await this.settings.get('pricing.monthlyCapMinor');
    const exceeded = offers.filter((offer) => offer.monthlyPriceMinor > caps[offer.vehicleType]);
    if (exceeded.length > 0) {
      throw new BadRequestException({
        message: 'El precio supera el tope mensual permitido',
        issues: exceeded.map((offer) => ({
          path: `${offer.shift}.${offer.vehicleType}`,
          message: `Máximo ${caps[offer.vehicleType]}`,
          capMinor: caps[offer.vehicleType],
        })),
      });
    }
  }

  private async getOwned(partnerId: string, id: string): Promise<ParkingLotRecord> {
    const lot = await this.repository.findById(id);
    if (!lot) throw new NotFoundException(NOT_FOUND);
    // 404 (no 403): no se revela que existe un parqueadero de otro aliado.
    if (lot.partnerId !== partnerId) throw new NotFoundException(NOT_FOUND);
    return lot;
  }
}
