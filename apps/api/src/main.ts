import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: config.get('CORS_ORIGINS'), credentials: true });
  app.setGlobalPrefix(config.get('API_PREFIX'), { exclude: ['health'] });
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('ParqueaVecino API').addBearerAuth().build(),
    );
    // UI en /<prefijo>/docs y JSON en /<prefijo>/docs-json (lo consume Orval en la web).
    SwaggerModule.setup(`${config.get('API_PREFIX')}/docs`, app, document);
  }

  await app.listen(config.get('API_PORT'));
}

void bootstrap();
