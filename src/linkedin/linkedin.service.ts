import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LinkedinJob } from './linkedin.interface';
import { ILE_DE_FRANCE_CITIES, REMOTE_KEYWORDS } from './idf-cities.constant';

const JSEARCH_HOST = 'jsearch.p.rapidapi.com';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class LinkedinService {
  private readonly logger = new Logger(LinkedinService.name);

  constructor(private readonly configService: ConfigService) {}

  async searchJobs(): Promise<LinkedinJob[]> {
    const apiKey = this.configService.get<string>('RAPIDAPI_KEY');
    const country = this.configService.get<string>('SEARCH_COUNTRY', 'fr');
    const language = this.configService.get<string>('SEARCH_LANGUAGE', 'fr');
    const keywords = this.parseKeywords(this.configService.get<string>('SEARCH_KEYWORDS', ''));

    if (!apiKey) {
      this.logger.error('RAPIDAPI_KEY non configurée');
      return [];
    }
    if (keywords.length === 0) {
      this.logger.error('SEARCH_KEYWORDS est vide');
      return [];
    }

    const results = await Promise.allSettled(
      keywords.map((kw) => this.fetchByKeyword(kw, country, language, apiKey)),
    );

    const merged = this.dedup(results);
    const filtered = merged
      .filter((job) => this.isInIleDeFrance(job))
      .filter((job) => this.isRecent(job.postedAt));

    this.logger.log(
      `[${keywords.join(' | ')}] → ${merged.length} brutes, ${filtered.length} retenues`,
    );
    return filtered;
  }

  private parseKeywords(raw: string): string[] {
    return raw.split(',').map((k) => k.trim()).filter(Boolean);
  }

  private dedup(results: PromiseSettledResult<LinkedinJob[]>[]): LinkedinJob[] {
    const seen = new Set<string>();
    const jobs: LinkedinJob[] = [];
    for (const result of results) {
      if (result.status === 'rejected') continue;
      for (const job of result.value) {
        if (!seen.has(job.id)) {
          seen.add(job.id);
          jobs.push(job);
        }
      }
    }
    return jobs;
  }

  private async fetchByKeyword(
    keyword: string,
    country: string,
    language: string,
    apiKey: string,
  ): Promise<LinkedinJob[]> {
    try {
      const response = await axios.get(`https://${JSEARCH_HOST}/search-v2`, {
        params: {
          query: `${keyword} Paris Île-de-France`,
          country,
          language,
          page: 1,
          num_pages: 1,
          date_posted: 'today',
        },
        headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': JSEARCH_HOST },
        timeout: 15000,
      });
      if (response.data?.status !== 'OK') return [];
      const raw = response.data.data?.jobs ?? response.data.data ?? [];
      return this.parseJobs(raw);
    } catch (error: any) {
      this.logger.error(`Erreur pour "${keyword}": ${error?.message}`);
      return [];
    }
  }

  private isInIleDeFrance(job: LinkedinJob): boolean {
    if (job.rawCity) {
      return ILE_DE_FRANCE_CITIES.has(job.rawCity.toLowerCase().trim());
    }
    const title = job.title.toLowerCase();
    return REMOTE_KEYWORDS.some((kw) => title.includes(kw));
  }

  private isRecent(postedAt: string): boolean {
    return Date.now() - new Date(postedAt).getTime() <= MAX_AGE_MS;
  }

  private parseJobs(data: any[]): LinkedinJob[] {
    if (!Array.isArray(data)) {
      this.logger.warn('Format de réponse inattendu de JSearch');
      return [];
    }
    return data.map((item) => ({
      id: item.job_id,
      title: item.job_title ?? 'Sans titre',
      company: item.employer_name ?? 'Inconnu',
      rawCity: item.job_city ?? null,
      location: [item.job_city, item.job_country].filter(Boolean).join(', '),
      url: item.job_apply_link ?? '',
      postedAt: item.job_posted_at_datetime_utc ?? new Date().toISOString(),
      description: item.job_description ?? '',
      employmentType: item.job_employment_type ?? '',
      experienceLevel:
        item.job_required_experience?.required_experience_in_months != null
          ? `${Math.round(item.job_required_experience.required_experience_in_months / 12)} ans requis`
          : '',
    }));
  }
}
