/** Puerto de lectura de parámetros de negocio. La implementación vive en `infrastructure`. */
export abstract class SettingsRepository {
  abstract findValue(key: string): Promise<unknown>;
}
