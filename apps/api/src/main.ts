import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, createOpenApiDocument } from './bootstrap';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // El webhook de Stripe verifica la firma sobre el cuerpo crudo.
    rawBody: true,
  });
  const config = app.get(AppConfigService);

  app.useLogger(app.get(Logger));
  configureApp(app);

  if (config.get('SWAGGER_ENABLED')) {
    // UI en /<prefijo>/docs y JSON en /<prefijo>/docs-json.
    SwaggerModule.setup(`${config.get('API_PREFIX')}/docs`, app, createOpenApiDocument(app));
  }

  await app.listen(config.get('API_PORT'));
}

void bootstrap();
