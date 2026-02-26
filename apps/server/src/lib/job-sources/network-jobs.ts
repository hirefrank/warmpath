import type { NormalizedJob } from "../../../../../packages/shared/src/contracts/job";

export interface NetworkJobsFetchParams {
  advisorSlug: string;
  category?: string;
  location?: string;
  seniority?: string;
}

export async function fetchNetworkJobs(
  params: NetworkJobsFetchParams
): Promise<NormalizedJob[]> {
  const { advisorSlug, category, location, seniority } = params;
  const baseUrl = `https://jobs.hirefrank.com/${advisorSlug}`;

  const manifestResponse = await fetch(`${baseUrl}/manifest.json`);
  if (!manifestResponse.ok) {
    throw new Error(`Failed to fetch manifest for advisor ${advisorSlug}`);
  }

  const manifest = await manifestResponse.json() as {
    categories?: Record<string, { file: string }>;
  };

  const jobFiles: string[] = [];

  if (category && location && seniority) {
    jobFiles.push(`${category}-${location}-${seniority}.json`);
    jobFiles.push(`${category}.json`);
  } else if (category) {
    jobFiles.push(`${category}.json`);
  } else if (manifest.categories) {
    for (const value of Object.values(manifest.categories)) {
      if (value?.file) {
        jobFiles.push(value.file);
      }
    }
  }

  const uniqueFiles = Array.from(new Set(jobFiles));
  const fileResults = await Promise.all(
    uniqueFiles.map(async (fileName) => {
      const response = await fetch(`${baseUrl}/${fileName}`);
      if (!response.ok) {
        return [] as NormalizedJob[];
      }

      const fileJobs = (await response.json()) as Array<{
        id: number;
        title: string;
        company: string;
        companyDomain?: string;
        department?: string;
        category?: string;
        location?: string;
        url: string;
        salary?: { min?: number; max?: number };
        postedAt?: string;
        firstSeen?: string;
        lastSeen?: string;
      }>;

      return fileJobs.map((job) => ({
        id: `${advisorSlug}:network:${job.id}`,
        source: "network" as const,
        advisorSlug,
        externalJobId: job.id,
        title: job.title,
        company: job.company,
        companyDomain: job.companyDomain,
        department: job.department,
        category: job.category,
        location: job.location,
        url: job.url,
        salaryMin: job.salary?.min,
        salaryMax: job.salary?.max,
        postedAt: job.postedAt,
        firstSeen: job.firstSeen,
        lastSeen: job.lastSeen,
      }));
    })
  );

  return dedupeJobs(fileResults.flat());
}

function dedupeJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const map = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    map.set(job.id, job);
  }
  return Array.from(map.values());
}
