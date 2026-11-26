import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppConfigService } from './config/app-config.service';

/** Rutas fuera del prefijo de la API (las usa el balanceador de AWS). */
const UNPREFIXED_ROUTES = ['health'];

/**
 * Configuración HTTP común. La usan `main.ts` y las pruebas e2e,
 * para que lo probado sea igual a lo que corre en producción.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfigService);
  const proxyHops = config.get('TRUST_PROXY_HOPS');
  if (proxyHops > 0) {
    (app.getHttpAdapter().getInstance() as Express).set('trust proxy', proxyHops);
  }
  app.use(helmet());
  app.use(cookieParser());
  const corsOrigins = config.get('CORS_ORIGINS');
  if (corsOrigins?.length) app.enableCors({ origin: corsOrigins, credentials: true });
  app.setGlobalPrefix(config.get('API_PREFIX'), { exclude: UNPREFIXED_ROUTES });
  app.enableShutdownHooks();
}

/** Nombres de operación legibles en el cliente generado: AuthController.login → authLogin. */
function operationId(controllerKey: string, methodKey: string): string {
  const resource = controllerKey.replace(/Controller$/, '');
  return `${resource.charAt(0).toLowerCase()}${resource.slice(1)}${methodKey
    .charAt(0)
    .toUpperCase()}${methodKey.slice(1)}`;
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('ParqueaVecino API')
      .setDescription('Mensualidades de parqueadero fraccionadas')
      .setVersion('1.0')
      .addCookieAuth('pv_access')
      .build(),
    { operationIdFactory: operationId },
  );
}
