import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ParkingLotStatus,
  type OfferInput,
  type ParkingLot,
  type ParkingLotInput,
  type ParkingLotUpdate,
} from '@parqueavecino/contracts';
import { AppConfigService } from '../../../config/app-config.service';
import { SettingsService } from '../../settings/application/settings.service';
import { ParkingLotsRepository, type ParkingLotRecord } from '../domain/parking-lots.repository';

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

  async upsertOffers(partnerId: string, id: string, offers: OfferInput[]): Promise<ParkingLot> {
    await this.getOwned(partnerId, id);
    await this.assertWithinPriceCap(offers);
    const lot = await this.repository.upsertOffers(id, offers, this.config.get('APP_CURRENCY'));
    return toPublic(lot);
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
    if (lot.partnerId !== partnerId) throw new ForbiddenException('Este parqueadero no es tuyo');
    return lot;
  }
}
