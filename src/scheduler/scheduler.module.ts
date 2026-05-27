import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { SeenJobsRepository } from './seen-jobs.repository';
import { LinkedinModule } from '../linkedin/linkedin.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [ConfigModule, LinkedinModule, EmailModule],
  providers: [SeenJobsRepository, SchedulerService],
  controllers: [SchedulerController],
})
export class SchedulerModule {}
