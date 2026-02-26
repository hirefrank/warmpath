import type { Database } from "bun:sqlite";
import type { NormalizedJob } from "../../../../../packages/shared/src/contracts/job";

interface JobRow {
  id: string;
  advisor_slug: string;
  source: "network" | "all";
  external_job_id: number;
  title: string;
  company: string;
  company_domain: string | null;
  department: string | null;
  category: string | null;
  location: string | null;
  url: string;
  salary_min: number | null;
  salary_max: number | null;
  posted_at: string | null;
  first_seen: string | null;
  last_seen: string | null;
  cached_at: string;
}

export interface JobFilters {
  advisorSlug?: string;
  company?: string;
  category?: string;
  location?: string;
  source?: "network" | "all";
  limit?: number;
}

export function upsertJobs(database: Database, jobs: NormalizedJob[]): void {
  if (jobs.length === 0) {
    return;
  }

  const upsert = database.query<unknown, any[]>(
    `
    INSERT INTO jobs_cache (
      id, advisor_slug, source, external_job_id, title, company, company_domain, department,
      category, location, url, salary_min, salary_max, posted_at, first_seen, last_seen, cached_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
    )
    ON CONFLICT(id) DO UPDATE SET
      advisor_slug = excluded.advisor_slug,
      source = excluded.source,
      external_job_id = excluded.external_job_id,
      title = excluded.title,
      company = excluded.company,
      company_domain = excluded.company_domain,
      department = excluded.department,
      category = excluded.category,
      location = excluded.location,
      url = excluded.url,
      salary_min = excluded.salary_min,
      salary_max = excluded.salary_max,
      posted_at = excluded.posted_at,
      first_seen = excluded.first_seen,
      last_seen = excluded.last_seen,
      cached_at = datetime('now')
    `
  ) as any;

  const transaction = database.transaction((records: NormalizedJob[]) => {
    for (const job of records) {
      upsert.run(
        job.id,
        job.advisorSlug,
        job.source,
        job.externalJobId,
        job.title,
        job.company,
        job.companyDomain ?? null,
        job.department ?? null,
        job.category ?? null,
        job.location ?? null,
        job.url,
        job.salaryMin ?? null,
        job.salaryMax ?? null,
        job.postedAt ?? null,
        job.firstSeen ?? null,
        job.lastSeen ?? null
      );
    }
  });

  transaction(jobs);
}

export function listJobs(database: Database, filters: JobFilters): NormalizedJob[] {
  const clauses: string[] = [];

  if (filters.advisorSlug) {
    clauses.push(`advisor_slug = '${escapeSql(filters.advisorSlug)}'`);
  }

  if (filters.company) {
    clauses.push(`LOWER(company) LIKE '%${escapeSql(filters.company.toLowerCase())}%'`);
  }

  if (filters.category) {
    clauses.push(`category = '${escapeSql(filters.category)}'`);
  }

  if (filters.location) {
    clauses.push(`LOWER(COALESCE(location, '')) LIKE '%${escapeSql(filters.location.toLowerCase())}%'`);
  }

  if (filters.source) {
    clauses.push(`source = '${escapeSql(filters.source)}'`);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = Number.isFinite(filters.limit) ? Math.max(1, Math.floor(filters.limit ?? 200)) : 200;

  const statement = database.query<JobRow, []>(
    `
    SELECT id, advisor_slug, source, external_job_id, title, company, company_domain, department,
           category, location, url, salary_min, salary_max, posted_at, first_seen, last_seen, cached_at
    FROM jobs_cache
    ${where}
    ORDER BY COALESCE(posted_at, first_seen, cached_at) DESC
    LIMIT ${limit}
    `
  ) as any;

  const rows = statement.all() as JobRow[];
  return rows.map(mapRowToJob);
}

export function getJobById(database: Database, id: string): NormalizedJob | null {
  const row = (database
    .query<JobRow, []>(
      `
      SELECT id, advisor_slug, source, external_job_id, title, company, company_domain, department,
             category, location, url, salary_min, salary_max, posted_at, first_seen, last_seen, cached_at
      FROM jobs_cache
      WHERE id = '${escapeSql(id)}'
      LIMIT 1
      `
    ) as any)
    .get() as JobRow | null;

  return row ? mapRowToJob(row) : null;
}

function mapRowToJob(row: JobRow): NormalizedJob {
  return {
    id: row.id,
    source: row.source,
    advisorSlug: row.advisor_slug,
    externalJobId: row.external_job_id,
    title: row.title,
    company: row.company,
    companyDomain: row.company_domain ?? undefined,
    department: row.department ?? undefined,
    category: row.category ?? undefined,
    location: row.location ?? undefined,
    url: row.url,
    salaryMin: row.salary_min ?? undefined,
    salaryMax: row.salary_max ?? undefined,
    postedAt: row.posted_at ?? undefined,
    firstSeen: row.first_seen ?? undefined,
    lastSeen: row.last_seen ?? undefined,
  };
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}
