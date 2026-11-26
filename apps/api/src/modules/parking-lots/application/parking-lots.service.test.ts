import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { OfferInput } from '@parqueavecino/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { AppConfigService } from '../../../config/app-config.service';
import type { SettingsService } from '../../settings/application/settings.service';
import type { ParkingLotRecord, ParkingLotsRepository } from '../domain/parking-lots.repository';
import { ParkingLotsService } from './parking-lots.service';

const lot: ParkingLotRecord = {
  id: 'lot-1',
  partnerId: 'partner-1',
  name: 'Parqueadero Calle 63',
  address: 'Cra 13 # 63-21',
  neighborhood: 'Chapinero',
  city: 'Bogotá',
  latitude: 4.6486,
  longitude: -74.0631,
  description: null,
  amenities: [],
  status: 'PENDING_VERIFICATION',
  verified: false,
  offers: [],
};

function setup(current: ParkingLotRecord = lot) {
  const upsertOffers = vi.fn(() => Promise.resolve(current));
  const setStatus = vi.fn(() => Promise.resolve());
  const repository = {
    findById: vi.fn((id: string) => Promise.resolve(id === current.id ? current : null)),
    upsertOffers,
    setStatus,
  } as unknown as ParkingLotsRepository;
  const settings = {
    get: vi.fn(() =>
      Promise.resolve({ CAR: 40_000_000, MOTORCYCLE: 15_000_000, BICYCLE: 6_000_000 }),
    ),
  } as unknown as SettingsService;
  const config = { get: () => 'COP' } as unknown as AppConfigService;
  return { service: new ParkingLotsService(repository, settings, config), upsertOffers, setStatus };
}

const offer = (price: number): OfferInput => ({
  shift: 'NIGHT',
  vehicleType: 'CAR',
  totalSpots: 10,
  monthlyPriceMinor: price,
  active: true,
});

describe('ParkingLotsService', () => {
  it('rechaza precios por encima del tope configurado', async () => {
    const { service, upsertOffers } = setup();
    await expect(service.upsertOffers('partner-1', 'lot-1', [offer(45_000_000)])).rejects.toThrow(
      BadRequestException,
    );
    expect(upsertOffers).not.toHaveBeenCalled();
  });

  it('guarda los cupos con la moneda de la configuración', async () => {
    const { service, upsertOffers } = setup();
    await service.upsertOffers('partner-1', 'lot-1', [offer(17_000_000)]);
    expect(upsertOffers).toHaveBeenCalledWith(
      'lot-1',
      [{ ...offer(17_000_000), availableSpots: 10 }],
      'COP',
    );
  });

  const withSold: ParkingLotRecord = {
    ...lot,
    status: 'ACTIVE',
    offers: [
      {
        id: 'offer-1',
        shift: 'NIGHT',
        vehicleType: 'CAR',
        totalSpots: 10,
        availableSpots: 7,
        monthlyPriceMinor: 17_000_000,
        currency: 'COP',
        active: true,
      },
    ],
  };

  it('recalcula los libres conservando las mensualidades vendidas', async () => {
    const { service, upsertOffers } = setup(withSold);
    await service.upsertOffers('partner-1', 'lot-1', [{ ...offer(17_000_000), totalSpots: 15 }]);
    expect(upsertOffers).toHaveBeenCalledWith(
      'lot-1',
      [{ ...offer(17_000_000), totalSpots: 15, availableSpots: 12 }],
      'COP',
    );
  });

  it('no deja bajar el total por debajo de lo vendido', async () => {
    const { service } = setup(withSold);
    await expect(
      service.upsertOffers('partner-1', 'lot-1', [{ ...offer(17_000_000), totalSpots: 2 }]),
    ).rejects.toThrow(ConflictException);
  });

  it('pausa un parqueadero aprobado pero no uno en verificación', async () => {
    const active = setup(withSold);
    await active.service.setStatusForPartner('partner-1', 'lot-1', 'PAUSED');
    expect(active.setStatus).toHaveBeenCalledWith('lot-1', 'PAUSED');
    const pending = setup();
    await expect(
      pending.service.setStatusForPartner('partner-1', 'lot-1', 'ACTIVE'),
    ).rejects.toThrow(ConflictException);
  });

  it('no deja editar parqueaderos de otro aliado', async () => {
    const { service } = setup();
    await expect(service.upsertOffers('otro', 'lot-1', [offer(1)])).rejects.toThrow(
      NotFoundException,
    );
  });

  it('no muestra al público parqueaderos sin verificar', async () => {
    const { service } = setup();
    await expect(service.getPublic('lot-1')).rejects.toThrow(NotFoundException);
  });
});
