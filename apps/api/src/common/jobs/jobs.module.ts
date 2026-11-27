import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { BullMqJobScheduler } from './bullmq-job-scheduler';
import { IntervalJobScheduler } from './interval-job-scheduler';
import { JobScheduler } from './job-scheduler';

/** Jobs programados: BullMQ si hay REDIS_URL; si no, temporizadores en proceso. */
@Global()
@Module({
  providers: [
    {
      provide: JobScheduler,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): JobScheduler => {
        const redisUrl = config.get('REDIS_URL');
        return redisUrl ? new BullMqJobScheduler(redisUrl) : new IntervalJobScheduler();
      },
    },
  ],
  exports: [JobScheduler],
})
export class JobsModule {}
