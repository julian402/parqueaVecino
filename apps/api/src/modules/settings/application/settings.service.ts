import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  PUBLIC_SETTING_KEYS,
  settingsSchemas,
  type PublicSettings,
  type SettingKey,
  type SettingValue,
} from '@parqueavecino/contracts';
import { AppConfigService } from '../../../config/app-config.service';
import { SettingsRepository } from '../domain/settings.repository';

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

  /** Para pruebas y para cuando el admin edite parámetros. */
  invalidate(key?: SettingKey): void {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }
}
