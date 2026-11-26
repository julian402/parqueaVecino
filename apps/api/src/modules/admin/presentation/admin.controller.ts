import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import {
  adminParkingLotListQuerySchema,
  adminParkingLotPageSchema,
  adminParkingLotReviewSchema,
  adminParkingLotSchema,
  adminPaymentListQuerySchema,
  adminPaymentPageSchema,
  adminSettingSchema,
  adminSettingUpdateSchema,
  adminStatsSchema,
  adminUserCreateSchema,
  adminUserListQuerySchema,
  adminUserPageSchema,
  adminUserSchema,
  adminUserUpdateSchema,
  UserRole,
  type AdminParkingLot,
  type AdminParkingLotListQuery,
  type AdminParkingLotPage,
  type AdminParkingLotReviewInput,
  type AdminPaymentListQuery,
  type AdminPaymentPage,
  type AdminSetting,
  type AdminSettingUpdateInput,
  type AdminStats,
  type AdminUser,
  type AdminUserCreateInput,
  type AdminUserListQuery,
  type AdminUserPage,
  type AdminUserUpdateInput,
} from '@parqueavecino/contracts';
import { z } from 'zod';
import { ApiZodResponse, UuidParam, ZodBody, ZodQuery } from '../../../common/validation/zod';
import {
  CurrentUser,
  Roles,
  type AuthenticatedUser,
} from '../../auth/presentation/auth.decorators';
import { ParkingLotsService } from '../../parking-lots/application/parking-lots.service';
import { PaymentsService } from '../../payments/application/payments.service';
import { SettingsService } from '../../settings/application/settings.service';
import { UsersService } from '../../users/application/users.service';
import { AdminService } from '../application/admin.service';

/** Panel del administrador (`/admin` en la web). Todo exige rol ADMIN. */
@ApiTags('admin')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly users: UsersService,
    private readonly lots: ParkingLotsService,
    private readonly payments: PaymentsService,
    private readonly settings: SettingsService,
  ) {}

  @Get('stats')
  @ApiZodResponse(adminStatsSchema)
  stats(): Promise<AdminStats> {
    return this.admin.stats();
  }

  // ---------- Usuarios ----------

  @Get('users')
  @ApiZodResponse(adminUserPageSchema)
  listUsers(@ZodQuery(adminUserListQuerySchema) query: AdminUserListQuery): Promise<AdminUserPage> {
    return this.users.list(query);
  }

  @Post('users')
  @ApiZodResponse(adminUserSchema, HttpStatus.CREATED)
  createUser(@ZodBody(adminUserCreateSchema) input: AdminUserCreateInput): Promise<AdminUser> {
    return this.admin.createUser(input);
  }

  @Patch('users/:id')
  @ApiZodResponse(adminUserSchema)
  updateUser(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam('id') id: string,
    @ZodBody(adminUserUpdateSchema) input: AdminUserUpdateInput,
  ): Promise<AdminUser> {
    return this.admin.updateUser(actor.id, id, input);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteUser(@CurrentUser() actor: AuthenticatedUser, @UuidParam('id') id: string): Promise<void> {
    return this.admin.deleteUser(actor.id, id);
  }

  // ---------- Parqueaderos ----------

  @Get('parking-lots')
  @ApiZodResponse(adminParkingLotPageSchema)
  listParkingLots(
    @ZodQuery(adminParkingLotListQuerySchema) query: AdminParkingLotListQuery,
  ): Promise<AdminParkingLotPage> {
    return this.lots.listForAdmin(query);
  }

  @Patch('parking-lots/:id/review')
  @ApiZodResponse(adminParkingLotSchema)
  reviewParkingLot(
    @UuidParam('id') id: string,
    @ZodBody(adminParkingLotReviewSchema) input: AdminParkingLotReviewInput,
  ): Promise<AdminParkingLot> {
    return this.lots.review(id, input);
  }

  // ---------- Pagos ----------

  @Get('payments')
  @ApiZodResponse(adminPaymentPageSchema)
  listPayments(
    @ZodQuery(adminPaymentListQuerySchema) query: AdminPaymentListQuery,
  ): Promise<AdminPaymentPage> {
    return this.payments.listForAdmin(query);
  }

  // ---------- Parámetros de negocio ----------

  @Get('settings')
  @ApiZodResponse(z.array(adminSettingSchema))
  listSettings(): Promise<AdminSetting[]> {
    return this.settings.listAll();
  }

  @Put('settings/:key')
  @ApiZodResponse(adminSettingSchema)
  updateSetting(
    @Param('key') key: string,
    @ZodBody(adminSettingUpdateSchema) input: AdminSettingUpdateInput,
  ): Promise<AdminSetting> {
    return this.settings.update(key, input.value);
  }
}
