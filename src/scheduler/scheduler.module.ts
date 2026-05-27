import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { LinkedinModule } from '../linkedin/linkedin.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [LinkedinModule, EmailModule],
  providers: [SchedulerService],
  controllers: [SchedulerController],
})
export class SchedulerModule {}
