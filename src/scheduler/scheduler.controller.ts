import { Controller, Post, Get } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';

@Controller()
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('trigger')
  async trigger() {
    await this.schedulerService.checkNewJobs();
    return { ok: true, seenTotal: this.schedulerService.getSeenCount() };
  }

  @Get('health')
  health() {
    return { status: 'ok', seenTotal: this.schedulerService.getSeenCount() };
  }
}
