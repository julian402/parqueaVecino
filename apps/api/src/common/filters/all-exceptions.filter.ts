import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError } from '@parqueavecino/contracts';
import type { Request, Response } from 'express';

/** Convierte cualquier excepción al formato estándar `ApiError` de `@parqueavecino/contracts`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const isHttp = exception instanceof HttpException;
    const statusCode: number = isHttp
      ? exception.getStatus()
      : Number(HttpStatus.INTERNAL_SERVER_ERROR);
    const payload = isHttp ? exception.getResponse() : undefined;

    const message =
      typeof payload === 'string'
        ? payload
        : isHttp && typeof payload === 'object' && payload !== null && 'message' in payload
          ? String(payload.message)
          : 'Error interno del servidor';

    if (statusCode >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(exception);
    }

    const body: ApiError = {
      statusCode,
      error: (HttpStatus as Record<number, string | undefined>)[statusCode] ?? 'ERROR',
      message,
      details: isHttp && typeof payload === 'object' ? payload : undefined,
      requestId: request.id,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    response.status(statusCode).json(body);
  }
}
