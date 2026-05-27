import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LinkedinService } from '../linkedin/linkedin.service';
import { EmailService } from '../email/email.service';
import { SeenJobsRepository } from './seen-jobs.repository';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private seenJobIds = new Set<string>();

  constructor(
    private readonly linkedinService: LinkedinService,
    private readonly emailService: EmailService,
    private readonly seenJobsRepo: SeenJobsRepository,
  ) {}

  async onModuleInit() {
    this.seenJobIds = await this.seenJobsRepo.loadAll();
    this.logger.log(`${this.seenJobIds.size} IDs chargés depuis PostgreSQL`);
  }

  @Cron('0 */15 * * * *')
  async checkNewJobs(): Promise<void> {
    this.logger.log('Vérification des nouvelles offres LinkedIn…');

    const jobs = await this.linkedinService.searchJobs();
    const newJobs = jobs.filter((job) => !this.seenJobIds.has(job.id));

    if (newJobs.length === 0) {
      this.logger.log('Aucune nouvelle offre');
      return;
    }

    this.logger.log(`${newJobs.length} nouvelle(s) offre(s) trouvée(s)`);

    try {
      await this.emailService.sendJobNotification(newJobs);
      const newIds = newJobs.map((job) => job.id);
      newIds.forEach((id) => this.seenJobIds.add(id));
      await this.seenJobsRepo.saveMany(newIds);
      this.logger.log(`Total suivi : ${this.seenJobIds.size} IDs`);
    } catch (error: any) {
      this.logger.error(`Erreur notification : ${error?.message}`);
    }
  }

  getSeenCount(): number {
    return this.seenJobIds.size;
  }
}
