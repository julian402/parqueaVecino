import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { JobScheduler, type ScheduledJob } from './job-scheduler';

/** Jobs con setInterval dentro de la API. Solo apto para una réplica (local y pruebas). */
@Injectable()
export class IntervalJobScheduler
  extends JobScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(IntervalJobScheduler.name);
  private readonly jobs: ScheduledJob[] = [];
  private readonly timers: NodeJS.Timeout[] = [];

  register(job: ScheduledJob): void {
    if (job.everySeconds > 0) this.jobs.push(job);
  }

  onApplicationBootstrap(): void {
    for (const job of this.jobs) {
      let running = false;
      const timer = setInterval(() => {
        // Si la ejecución anterior sigue en curso, se salta este turno.
        if (running) return;
        running = true;
        job
          .run()
          .catch((error: unknown) => this.logger.error({ err: error, job: job.name }, 'Job falló'))
          .finally(() => {
            running = false;
          });
      }, job.everySeconds * 1000);
      timer.unref();
      this.timers.push(timer);
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers) clearInterval(timer);
  }
}
