import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  PUBLIC_SETTING_KEYS,
  SETTING_KEYS,
  settingsSchemas,
  type AdminSetting,
  type PublicSettings,
  type SettingKey,
  type SettingValue,
} from '@parqueavecino/contracts';
import { AppConfigService } from '../../../config/app-config.service';
import { SettingsRepository } from '../domain/settings.repository';

function isSettingKey(key: string): key is SettingKey {
  return (SETTING_KEYS as string[]).includes(key);
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Lee los parámetros de negocio (comisión, franjas, topes...) validados contra su esquema.
 * Usa una caché en memoria con TTL configurable para no consultar la BD en cada petición.
 */
@Injectable()
export class SettingsService {
  private readonly cache = new Map<SettingKey, CacheEntry>();

  constructor(
    private readonly repository: SettingsRepository,
    private readonly config: AppConfigService,
  ) {}

  async get<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as SettingValue<K>;
    }

    const raw = await this.repository.findValue(key);
    const parsed = settingsSchemas[key].safeParse(raw);
    if (!parsed.success) {
      // Es un error de configuración (falta correr el seed o el valor es inválido), no del usuario.
      throw new InternalServerErrorException(`Parámetro de negocio "${key}" ausente o inválido`);
    }

    const ttlMs = this.config.get('SETTINGS_CACHE_TTL_SECONDS') * 1000;
    this.cache.set(key, { value: parsed.data, expiresAt: Date.now() + ttlMs });
    return parsed.data as SettingValue<K>;
  }

  async getPublic(): Promise<PublicSettings> {
    const entries = await Promise.all(
      PUBLIC_SETTING_KEYS.map(async (key) => [key, await this.get(key)] as const),
    );
    return Object.fromEntries(entries) as PublicSettings;
  }

  /** Todos los parámetros, para el panel del admin. */
  async listAll(): Promise<AdminSetting[]> {
    const rows = await this.repository.listAll();
    return rows
      .filter((row) => isSettingKey(row.key))
      .map((row) => ({ ...row, updatedAt: row.updatedAt.toISOString() }));
  }

  /** Edición desde el panel: valida el valor contra el esquema de la clave e invalida la caché. */
  async update(key: string, value: unknown): Promise<AdminSetting> {
    if (!isSettingKey(key)) throw new NotFoundException('Parámetro no encontrado');
    const parsed = settingsSchemas[key].safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Valor inválido para este parámetro',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    const saved = await this.repository.save(key, parsed.data);
    if (!saved) throw new NotFoundException('Parámetro no encontrado');
    this.invalidate(key);
    return { ...saved, updatedAt: saved.updatedAt.toISOString() };
  }

  /** Para pruebas y para cuando el admin edite parámetros. */
  invalidate(key?: SettingKey): void {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }
}
