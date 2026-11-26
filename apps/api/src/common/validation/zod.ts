import {
  BadRequestException,
  Body,
  Param,
  ParseUUIDPipe,
  PipeTransform,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse, type SchemaObject } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

/** Convierte un esquema Zod a OpenAPI 3.0 para Swagger y para el cliente generado (Orval). */
export function toOpenApiSchema(schema: ZodType, io: 'input' | 'output' = 'output'): SchemaObject {
  const { $schema: _ignored, ...jsonSchema } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  });
  return jsonSchema as SchemaObject;
}

export class ZodValidationPipe<T extends ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}

type ParamDecoratorTarget = Parameters<ParameterDecorator>;

function describeMethod(
  target: object,
  key: string | symbol | undefined,
  decorator: MethodDecorator,
): void {
  if (key === undefined) return;
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (descriptor) decorator(target, key, descriptor);
}

/** `@ZodBody(schema)`: valida el body con Zod y lo documenta en OpenAPI. */
export function ZodBody(schema: ZodType): ParameterDecorator {
  return (...[target, key, index]: ParamDecoratorTarget) => {
    Body(new ZodValidationPipe(schema))(target, key, index);
    describeMethod(target, key, ApiBody({ schema: toOpenApiSchema(schema, 'input') }));
  };
}

/** `@ZodQuery(schema)`: valida el query string completo con Zod. */
export function ZodQuery(schema: ZodType): ParameterDecorator {
  return (...[target, key, index]: ParamDecoratorTarget) => {
    Query(new ZodValidationPipe(schema))(target, key, index);
    describeMethod(
      target,
      key,
      ApiQuery({ type: 'object', schema: toOpenApiSchema(schema, 'input') }),
    );
  };
}

/** `@UuidParam('id')`: parámetro de ruta que debe ser UUID. */
export function UuidParam(name: string): ParameterDecorator {
  return Param(name, new ParseUUIDPipe());
}

/** Documenta la respuesta con el esquema Zod de `@parqueavecino/contracts`. */
export function ApiZodResponse(schema: ZodType, status = 200, description = 'OK'): MethodDecorator {
  return ApiResponse({ status, description, schema: toOpenApiSchema(schema) });
}
