export interface StoredSetting {
  key: string;
  value: unknown;
  description: string;
  updatedAt: Date;
}

/** Puerto de lectura/escritura de parámetros de negocio. La implementación vive en `infrastructure`. */
export abstract class SettingsRepository {
  abstract findValue(key: string): Promise<unknown>;
  abstract listAll(): Promise<StoredSetting[]>;
  /** Actualiza el valor de una clave existente (las claves las crea el seed). */
  abstract save(key: string, value: unknown): Promise<StoredSetting | null>;
}
