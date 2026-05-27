import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LinkedinJob } from './linkedin.interface';

const JSEARCH_HOST = 'jsearch.p.rapidapi.com';

// Villes et communes d'Île-de-France (75, 77, 78, 91, 92, 93, 94, 95)
const ILE_DE_FRANCE_CITIES = new Set([
  'paris',
  // Hauts-de-Seine (92)
  'nanterre', 'boulogne-billancourt', 'issy-les-moulineaux', 'levallois-perret',
  'antony', 'colombes', 'asnières-sur-seine', 'neuilly-sur-seine', 'clichy',
  'rueil-malmaison', 'saint-cloud', 'courbevoie', 'puteaux', 'gennevilliers',
  'montrouge', 'châtillon', 'malakoff', 'vanves', 'sceaux', 'bagneux',
  // Seine-Saint-Denis (93)
  'saint-denis', 'montreuil', 'aubervilliers', 'aulnay-sous-bois', 'pantin',
  'bobigny', 'épinay-sur-seine', 'drancy', 'noisy-le-grand', 'bondy',
  'le blanc-mesnil', 'rosny-sous-bois', 'bagnolet',
  // Val-de-Marne (94)
  'créteil', 'vitry-sur-seine', 'champigny-sur-marne', 'saint-maur-des-fossés',
  'vincennes', 'ivry-sur-seine', 'maisons-alfort', 'alfortville', 'charenton-le-pont',
  'nogent-sur-marne', 'joinville-le-pont', 'fontenay-sous-bois',
  // Yvelines (78)
  'versailles', 'saint-germain-en-laye', 'mantes-la-jolie', 'rambouillet',
  'guyancourt', 'vélizy-villacoublay', 'poissy', 'sartrouville',
  // Essonne (91)
  'évry', 'évry-courcouronnes', 'corbeil-essonnes', 'massy', 'palaiseau',
  'longjumeau', 'gif-sur-yvette', 'orsay',
  // Val-d\'Oise (95)
  'cergy', 'argenteuil', 'sarcelles', 'pontoise', 'ermont', 'garges-lès-gonesse',
  'eaubonne', 'enghien-les-bains',
  // Seine-et-Marne (77)
  'melun', 'meaux', 'fontainebleau', 'chelles', 'torcy', 'lognes',
]);

@Injectable()
export class LinkedinService {
  private readonly logger = new Logger(LinkedinService.name);

  constructor(private readonly configService: ConfigService) {}

  async searchJobs(): Promise<LinkedinJob[]> {
    const apiKey = this.configService.get<string>('RAPIDAPI_KEY');
    const country = this.configService.get<string>('SEARCH_COUNTRY', 'fr');
    const language = this.configService.get<string>('SEARCH_LANGUAGE', 'fr');

    // SEARCH_KEYWORDS peut contenir plusieurs filtres séparés par virgule
    // ex: "Node.js, NestJS, Nest.js, Node"
    const rawKeywords = this.configService.get<string>('SEARCH_KEYWORDS', '');
    const filters = rawKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    if (!apiKey) {
      this.logger.error('RAPIDAPI_KEY non configurée');
      return [];
    }

    if (filters.length === 0) {
      this.logger.error('SEARCH_KEYWORDS est vide');
      return [];
    }

    // Appels parallèles — un par filtre
    const results = await Promise.allSettled(
      filters.map((keyword) => this.fetchByKeyword(keyword, country, language, apiKey)),
    );

    // Fusionner et dédupliquer par job_id
    const seen = new Set<string>();
    const merged: LinkedinJob[] = [];

    for (const result of results) {
      if (result.status === 'rejected') continue;
      for (const job of result.value) {
        if (!seen.has(job.id)) {
          seen.add(job.id);
          merged.push(job);
        }
      }
    }

    const filtered = merged.filter((job) => this.isInIleDeFrance(job));
    this.logger.log(
      `[${filters.join(' | ')}] → ${merged.length} brutes, ${filtered.length} en Île-de-France`,
    );
    return filtered;
  }

  private async fetchByKeyword(
    keyword: string,
    country: string,
    language: string,
    apiKey: string,
  ): Promise<LinkedinJob[]> {
    const query = `${keyword} Paris Île-de-France`;
    try {
      const response = await axios.get(`https://${JSEARCH_HOST}/search`, {
        params: { query, country, language, page: 1, num_pages: 1, date_posted: 'today' },
        headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': JSEARCH_HOST },
      });
      if (response.data?.status !== 'OK') return [];
      return this.parseJobs(response.data.data ?? []);
    } catch (error: any) {
      this.logger.error(`Erreur pour "${keyword}": ${error?.message}`);
      return [];
    }
  }

  private isInIleDeFrance(job: LinkedinJob): boolean {
    // Offre localisée en Île-de-France
    if (job.rawCity) {
      return ILE_DE_FRANCE_CITIES.has(job.rawCity.toLowerCase().trim());
    }

    // job_city null → remote ou hybride : accepter si le titre le mentionne explicitement
    const REMOTE_KEYWORDS = ['remote', 'hybride', 'hybrid', 'télétravail', 'teletravail', 'full remote'];
    const titleLower = job.title.toLowerCase();
    return REMOTE_KEYWORDS.some((kw) => titleLower.includes(kw));
  }

  private parseJobs(data: any[]): LinkedinJob[] {
    if (!Array.isArray(data)) {
      this.logger.warn('Format de réponse inattendu de JSearch');
      return [];
    }

    return data.map((item: any) => ({
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
