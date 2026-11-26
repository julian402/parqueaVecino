import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import {
  bookingCheckoutSchema,
  bookingReceiptSchema,
  bookingSchema,
  createBookingSchema,
  partnerSummarySchema,
  UserRole,
  type Booking,
  type BookingCheckout,
  type BookingReceipt,
  type CreateBookingInput,
  type PartnerSummary,
} from '@parqueavecino/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { ApiZodResponse, UuidParam, ZodBody } from '../../../common/validation/zod';
import {
  CurrentUser,
  Public,
  Roles,
  type AuthenticatedUser,
} from '../../auth/presentation/auth.decorators';
import { BookingsService } from '../application/bookings.service';

/** Mensualidades del conductor (mockups 4, 5 y 6). El admin también puede comprar para probar. */
@ApiTags('bookings')
@Roles(UserRole.DRIVER, UserRole.ADMIN)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @ApiZodResponse(bookingCheckoutSchema, HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(createBookingSchema) input: CreateBookingInput,
  ): Promise<BookingCheckout> {
    return this.bookings.create(user.id, input);
  }

  @Get()
  @ApiZodResponse(z.array(bookingSchema))
  list(@CurrentUser() user: AuthenticatedUser): Promise<Booking[]> {
    return this.bookings.listForDriver(user.id);
  }

  @Get(':id/checkout')
  @ApiZodResponse(bookingCheckoutSchema)
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @UuidParam('id') id: string,
  ): Promise<BookingCheckout> {
    return this.bookings.checkout(user.id, id);
  }

  @Post(':id/renew')
  @ApiZodResponse(bookingCheckoutSchema, HttpStatus.CREATED)
  renew(
    @CurrentUser() user: AuthenticatedUser,
    @UuidParam('id') id: string,
  ): Promise<BookingCheckout> {
    return this.bookings.renew(user.id, id);
  }

  @Get(':id/receipt')
  @ApiZodResponse(bookingReceiptSchema)
  receipt(
    @CurrentUser() user: AuthenticatedUser,
    @UuidParam('id') id: string,
  ): Promise<BookingReceipt> {
    return this.bookings.receipt(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiZodResponse(bookingSchema)
  cancel(@CurrentUser() user: AuthenticatedUser, @UuidParam('id') id: string): Promise<Booking> {
    return this.bookings.cancel(user.id, id);
  }
}

/** Panel del aliado: resumen de cupos, reservas e ingresos (pantalla 7). */
@ApiTags('partner')
@Roles(UserRole.PARTNER)
@Controller('partner')
export class PartnerController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('summary')
  @ApiZodResponse(partnerSummarySchema)
  summary(@CurrentUser() user: AuthenticatedUser): Promise<PartnerSummary> {
    return this.bookings.partnerSummary(user.id);
  }
}

/** Webhook de Stripe: público, pero solo se procesa si la firma es válida. */
@Controller('payments/webhooks')
export class PaymentWebhooksController {
  constructor(private readonly bookings: BookingsService) {}

  @Public()
  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async stripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    if (!req.rawBody || !signature) throw new BadRequestException('Webhook sin firma');
    try {
      await this.bookings.handlePaymentWebhook(req.rawBody, signature);
    } catch (error) {
      if (error instanceof Error && error.name === 'StripeSignatureVerificationError') {
        throw new BadRequestException('Firma de webhook inválida');
      }
      throw error;
    }
    return { received: true };
  }
}
