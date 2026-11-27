/** Tarea periódica (barrido de reservas, avisos de vencimiento...). Debe ser idempotente. */
export interface ScheduledJob {
  /** Nombre único y estable: identifica el job en la cola. */
  name: string;
  /** Cada cuántos segundos corre; 0 lo desactiva. */
  everySeconds: number;
  run: () => Promise<void>;
}

/**
 * Puerto de jobs programados. Con Redis usa BullMQ (una sola ejecución aunque haya varias
 * réplicas de la API); sin Redis, temporizadores en el mismo proceso (desarrollo y pruebas).
 * Los módulos registran sus jobs en `onModuleInit`; arrancan cuando la app termina de iniciar.
 */
export abstract class JobScheduler {
  abstract register(job: ScheduledJob): void;
}
