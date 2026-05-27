import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LinkedinService } from '../linkedin/linkedin.service';
import { EmailService } from '../email/email.service';
import { LinkedinJob } from '../linkedin/linkedin.interface';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly seenJobIds = new Set<string>();

  constructor(
    private readonly linkedinService: LinkedinService,
    private readonly emailService: EmailService,
  ) {}

  // Toutes les 15 minutes
  @Cron('0 */15 * * * *')
  async checkNewJobs(): Promise<void> {
    this.logger.log('Vérification des nouvelles offres LinkedIn…');

    const jobs = await this.linkedinService.searchJobs();

    if (jobs.length === 0) {
      this.logger.log('Aucune offre retournée par l\'API');
      return;
    }

    const newJobs = jobs.filter((job) => !this.seenJobIds.has(job.id));

    if (newJobs.length === 0) {
      this.logger.log('Aucune nouvelle offre depuis la dernière vérification');
      return;
    }

    this.logger.log(`${newJobs.length} nouvelle(s) offre(s) trouvée(s)`);

    try {
      await this.emailService.sendJobNotification(newJobs);
      newJobs.forEach((job) => this.seenJobIds.add(job.id));
      this.logger.log(`IDs enregistrés — total suivi: ${this.seenJobIds.size}`);
    } catch (error: any) {
      this.logger.error(`Impossible d'envoyer la notification: ${error?.message}`);
    }
  }

  getSeenCount(): number {
    return this.seenJobIds.size;
  }
}
