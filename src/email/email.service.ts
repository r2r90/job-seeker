import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { LinkedinJob } from '../linkedin/linkedin.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const smtpPort = parseInt(this.configService.get<string>('SMTP_PORT', '587'), 10);
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  async sendJobNotification(jobs: LinkedinJob[]): Promise<void> {
    const to = this.configService.get<string>('NOTIFY_EMAIL');
    const keywords = this.configService.get<string>('SEARCH_KEYWORDS');
    const location = this.configService.get<string>('SEARCH_LOCATION');

    if (!to) {
      this.logger.error('NOTIFY_EMAIL non configuré');
      return;
    }

    const subject = `[LinkedIn] ${jobs.length} nouvelle(s) offre(s) — ${keywords} à ${location}`;

    const html = this.buildEmailHtml(jobs, keywords, location);
    const text = this.buildEmailText(jobs);

    try {
      await this.transporter.sendMail({ from: this.configService.get<string>('SMTP_USER'), to, subject, html, text });
      this.logger.log(`Email envoyé à ${to} avec ${jobs.length} offre(s)`);
    } catch (error: any) {
      this.logger.error(`Échec de l'envoi email: ${error?.message}`);
      throw error;
    }
  }

  private buildEmailHtml(jobs: LinkedinJob[], keywords: string, location: string): string {
    const jobRows = jobs
      .map(
        (job) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
            <a href="${job.url}" style="font-weight:600;color:#0a66c2;text-decoration:none;">${job.title}</a>
            ${job.employmentType ? `<span style="font-size:12px;color:#6b7280;margin-left:8px;">${job.employmentType}</span>` : ''}
          </td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#374151;">${job.company}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${job.location}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;">${job.postedAt}</td>
        </tr>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Nouvelles offres LinkedIn</title></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:20px;">
  <div style="max-width:800px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#0a66c2;padding:24px;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Nouvelles offres LinkedIn</h1>
      <p style="color:#cce4ff;margin:8px 0 0;">${jobs.length} offre(s) trouvée(s) pour <strong>${keywords}</strong> à <strong>${location}</strong></p>
    </div>
    <div style="padding:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:12px;text-align:left;color:#374151;font-size:13px;text-transform:uppercase;">Poste</th>
            <th style="padding:12px;text-align:left;color:#374151;font-size:13px;text-transform:uppercase;">Entreprise</th>
            <th style="padding:12px;text-align:left;color:#374151;font-size:13px;text-transform:uppercase;">Lieu</th>
            <th style="padding:12px;text-align:left;color:#374151;font-size:13px;text-transform:uppercase;">Publié</th>
          </tr>
        </thead>
        <tbody>${jobRows}</tbody>
      </table>
    </div>
    <div style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:12px;">
      Généré automatiquement par linkedin-job-notifier
    </div>
  </div>
</body>
</html>`;
  }

  private buildEmailText(jobs: LinkedinJob[]): string {
    return jobs
      .map((job) => `${job.title} — ${job.company} (${job.location})\n${job.url}`)
      .join('\n\n');
  }
}
