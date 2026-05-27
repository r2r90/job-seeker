import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LinkedinService } from '../linkedin/linkedin.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private seenJobIds = new Set<string>();

  constructor(
    private readonly linkedinService: LinkedinService,
    private readonly emailService: EmailService,
  ) {}

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
      newJobs.forEach((job) => this.seenJobIds.add(job.id));
      this.logger.log(`Total suivi : ${this.seenJobIds.size} IDs`);
    } catch (error: any) {
      this.logger.error(`Erreur notification : ${error?.message}`);
    }
  }

  getSeenCount(): number {
    return this.seenJobIds.size;
  }
}
