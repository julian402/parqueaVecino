import { Controller, Get, HttpStatus, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  parkingLotInputSchema,
  parkingLotSchema,
  parkingLotUpdateSchema,
  searchQuerySchema,
  searchResponseSchema,
  upsertOffersSchema,
  partnerLotStatusSchema,
  type PartnerLotStatusInput,
  UserRole,
  type ParkingLot,
  type ParkingLotInput,
  type ParkingLotUpdate,
  type SearchQuery,
  type SearchResponse,
  type UpsertOffersInput,
} from '@parqueavecino/contracts';
import { z } from 'zod';
import { ApiZodResponse, UuidParam, ZodBody, ZodQuery } from '../../../common/validation/zod';
import {
  CurrentUser,
  Public,
  Roles,
  type AuthenticatedUser,
} from '../../auth/presentation/auth.decorators';
import { ParkingLotsService } from '../application/parking-lots.service';
import { ParkingSearchService } from '../application/parking-search.service';

@ApiTags('parking-lots')
@Controller('parking-lots')
export class ParkingLotsController {
  constructor(
    private readonly lots: ParkingLotsService,
    private readonly searchService: ParkingSearchService,
  ) {}

  /** Declarada antes de `:id` para que "search" no se interprete como un id. */
  @Public()
  @Get('search')
  @ApiZodResponse(searchResponseSchema)
  search(@ZodQuery(searchQuerySchema) query: SearchQuery): Promise<SearchResponse> {
    return this.searchService.search(query);
  }

  @Public()
  @Get(':id')
  @ApiZodResponse(parkingLotSchema)
  get(@UuidParam('id') id: string): Promise<ParkingLot> {
    return this.lots.getPublic(id);
  }
}

/** Gestión de parqueaderos y cupos por parte del aliado (pantalla 7 del mockup). */
@ApiTags('partner')
@Roles(UserRole.PARTNER)
@Controller('partner/parking-lots')
export class PartnerParkingLotsController {
  constructor(private readonly lots: ParkingLotsService) {}

  @Get()
  @ApiZodResponse(z.array(parkingLotSchema))
  list(@CurrentUser() user: AuthenticatedUser): Promise<ParkingLot[]> {
    return this.lots.listForPartner(user.id);
  }

  @Post()
  @ApiZodResponse(parkingLotSchema, HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(parkingLotInputSchema) input: ParkingLotInput,
  ): Promise<ParkingLot> {
    return this.lots.createForPartner(user.id, input);
  }

  @Patch(':id')
  @ApiZodResponse(parkingLotSchema)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @UuidParam('id') id: string,
    @ZodBody(parkingLotUpdateSchema) input: ParkingLotUpdate,
  ): Promise<ParkingLot> {
    return this.lots.updateForPartner(user.id, id, input);
  }

  @Patch(':id/status')
  @ApiZodResponse(parkingLotSchema)
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @UuidParam('id') id: string,
    @ZodBody(partnerLotStatusSchema) input: PartnerLotStatusInput,
  ): Promise<ParkingLot> {
    return this.lots.setStatusForPartner(user.id, id, input.status);
  }

  @Put(':id/offers')
  @ApiZodResponse(parkingLotSchema)
  upsertOffers(
    @CurrentUser() user: AuthenticatedUser,
    @UuidParam('id') id: string,
    @ZodBody(upsertOffersSchema) input: UpsertOffersInput,
  ): Promise<ParkingLot> {
    return this.lots.upsertOffers(user.id, id, input.offers);
  }
}
