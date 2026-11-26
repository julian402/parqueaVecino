import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './common/database/database.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';
import { ParkingLotsModule } from './modules/parking-lots/parking-lots.module';
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
    // Módulos de dominio (uno por carpeta en src/modules):
    HealthModule,
    SettingsModule,
    AuthModule,
    UsersModule,
    ParkingLotsModule,
    GeocodingModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
