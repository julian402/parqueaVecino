import { Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  payoutAccountSchema,
  providerLinkSchema,
  UserRole,
  type PayoutAccount,
  type ProviderLink,
} from '@parqueavecino/contracts';
import { ApiZodResponse } from '../../../common/validation/zod';
import {
  CurrentUser,
  Roles,
  type AuthenticatedUser,
} from '../../auth/presentation/auth.decorators';
import { UsersService } from '../../users/application/users.service';
import { PaymentsService } from '../application/payments.service';

/** Cuenta de pagos del aliado (Stripe Connect): conectar, ver estado y abrir su panel. */
@ApiTags('partner')
@Roles(UserRole.PARTNER)
@Controller('partner/payout-account')
export class PartnerPayoutsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly users: UsersService,
  ) {}

  @Get()
  @ApiZodResponse(payoutAccountSchema)
  get(@CurrentUser() user: AuthenticatedUser): Promise<PayoutAccount> {
    return this.payments.payoutAccount(user.id);
  }

  @Post('onboarding')
  @ApiZodResponse(providerLinkSchema, HttpStatus.CREATED)
  async onboarding(@CurrentUser() user: AuthenticatedUser): Promise<ProviderLink> {
    const { id, email, fullName } = await this.users.getOrThrow(user.id);
    return this.payments.startOnboarding({ id, email, fullName });
  }

  @Post('dashboard')
  @ApiZodResponse(providerLinkSchema, HttpStatus.CREATED)
  dashboard(@CurrentUser() user: AuthenticatedUser): Promise<ProviderLink> {
    return this.payments.dashboardLink(user.id);
  }
}
