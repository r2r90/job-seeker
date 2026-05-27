export interface LinkedinJob {
  id: string;
  title: string;
  company: string;
  location: string;
  rawCity: string | null;
  url: string;
  postedAt: string;
  description?: string;
  employmentType?: string;
  experienceLevel?: string;
}
