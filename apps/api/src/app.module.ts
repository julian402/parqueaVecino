import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { seconds, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './common/database/database.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { HealthModule } from './modules/health/health.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { ParkingLotsModule } from './modules/parking-lots/parking-lots.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UsersModule } from './modules/users/users.module';

const REQUEST_ID_HEADER = 'x-request-id';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          genReqId: (req, res) => {
            const id = (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? randomUUID();
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
          },
          transport: config.isProduction ? undefined : { target: 'pino-pretty' },
          redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        },
      }),
    }),
    // Límite de intentos: lo aplica ThrottlerGuard solo donde se declara (rutas de auth).
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: 'auth',
            ttl: seconds(config.get('AUTH_RATE_LIMIT_WINDOW_SECONDS')),
            limit: config.get('AUTH_RATE_LIMIT_MAX'),
          },
        ],
        errorMessage: 'Demasiados intentos. Espera un momento y vuelve a intentarlo.',
      }),
    }),
    // Módulos de dominio (uno por carpeta en src/modules):
    HealthModule,
    SettingsModule,
    AuthModule,
    UsersModule,
    ParkingLotsModule,
    GeocodingModule,
    PaymentsModule,
    BookingsModule,
    AdminModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
