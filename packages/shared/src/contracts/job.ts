export type JobSource = "network" | "all";

export interface NormalizedJob {
  id: string;
  source: JobSource;
  advisorSlug: string;
  externalJobId: number;
  title: string;
  company: string;
  companyDomain?: string;
  department?: string;
  category?: string;
  location?: string;
  url: string;
  salaryMin?: number;
  salaryMax?: number;
  postedAt?: string;
  firstSeen?: string;
  lastSeen?: string;
}

export interface JobsSyncRequest {
  advisor_slug: string;
  category?: string;
  location?: string;
  seniority?: string;
  source?: JobSource;
}

export interface JobsSyncResponse {
  synced: number;
  source: JobSource;
  cached_at: string;
}
