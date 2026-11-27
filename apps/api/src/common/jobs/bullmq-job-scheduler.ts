import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { JobScheduler, type ScheduledJob } from './job-scheduler';

const QUEUE_NAME = 'scheduled-jobs';
/** Historial que se conserva en Redis para diagnosticar (los más recientes). */
const KEEP_FINISHED_JOBS = 50;

/**
 * Jobs programados con BullMQ sobre Redis. Cada job tiene un "job scheduler" con su intervalo:
 * aunque corran varias réplicas, cada ejecución la toma un solo worker.
 */
@Injectable()
export class BullMqJobScheduler
  extends JobScheduler
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(BullMqJobScheduler.name);
  private readonly jobs = new Map<string, ScheduledJob>();
  private readonly connection: ConnectionOptions;
  private queue: Queue | undefined;
  private worker: Worker | undefined;

  constructor(redisUrl: string) {
    super();
    // maxRetriesPerRequest null: requisito de BullMQ para los workers (comandos bloqueantes).
    this.connection = { url: redisUrl, maxRetriesPerRequest: null };
  }

  register(job: ScheduledJob): void {
    this.jobs.set(job.name, job);
  }

  async onApplicationBootstrap(): Promise<void> {
    this.queue = new Queue(QUEUE_NAME, { connection: this.connection });
    this.queue.on('error', (error) => this.logger.error({ err: error }, 'Error en la cola'));

    for (const job of this.jobs.values()) {
      if (job.everySeconds > 0) {
        await this.queue.upsertJobScheduler(
          job.name,
          { every: job.everySeconds * 1000 },
          {
            name: job.name,
            opts: { removeOnComplete: KEEP_FINISHED_JOBS, removeOnFail: KEEP_FINISHED_JOBS },
          },
        );
      } else {
        // Desactivado por configuración: se quita el programador que hubiera quedado en Redis.
        await this.queue.removeJobScheduler(job.name);
      }
    }

    this.worker = new Worker(
      QUEUE_NAME,
      async (task) => {
        const job = this.jobs.get(task.name);
        if (!job) {
          this.logger.warn({ job: task.name }, 'Job sin handler: se ignora');
          return;
        }
        await job.run();
      },
      { connection: this.connection, concurrency: 1 },
    );
    this.worker.on('failed', (task, error) =>
      this.logger.error({ err: error, job: task?.name }, 'Job falló'),
    );
    this.worker.on('error', (error) => this.logger.error({ err: error }, 'Error en el worker'));
    this.logger.log(`Jobs programados con BullMQ: ${[...this.jobs.keys()].join(', ')}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
  }
}
