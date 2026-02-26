import type { NormalizedJob } from "@warmpath/shared/contracts/job";
import type {
  RunSecondDegreeScoutResponse,
  ScoutRunStats,
  SecondDegreeScoutRequest,
  SecondDegreeScoutRun,
} from "@warmpath/shared/contracts/scout";
import type { IntroDraftResponse, RankedPath } from "@warmpath/shared/contracts/warm-path";

const API_BASE = "";

export async function syncJobs(input: {
  advisor_slug: string;
  category?: string;
  location?: string;
  seniority?: string;
  source?: "network" | "all";
}): Promise<{ synced: number; source: string; total_cached: number }> {
  const response = await fetch(`${API_BASE}/api/warm-path/jobs/sync`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync jobs (${response.status})`);
  }

  return response.json();
}

export async function listJobs(filters: {
  advisor_slug?: string;
  company?: string;
  category?: string;
  location?: string;
  source?: "network" | "all";
  limit?: number;
}): Promise<NormalizedJob[]> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && `${value}`.length > 0) {
      search.set(key, String(value));
    }
  }

  const response = await fetch(`${API_BASE}/api/warm-path/jobs?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to list jobs (${response.status})`);
  }

  const payload = (await response.json()) as { jobs: NormalizedJob[] };
  return payload.jobs;
}

export async function rankWarmPaths(input: {
  advisor_slug: string;
  job_cache_id: string;
}): Promise<{ run_id: string; top_paths: RankedPath[] }> {
  const response = await fetch(`${API_BASE}/api/warm-path/rank`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to rank warm paths (${response.status})`);
  }

  return response.json();
}

export async function draftIntro(input: {
  run_id: string;
  colleague_id: string;
  extra_context?: string;
}): Promise<IntroDraftResponse> {
  const response = await fetch(`${API_BASE}/api/warm-path/runs/${input.run_id}/intro-draft`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      colleague_id: input.colleague_id,
      extra_context: input.extra_context,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate draft (${response.status})`);
  }

  return response.json();
}

export interface ContactRecord {
  id: string;
  name: string;
  current_title: string | null;
  current_company: string | null;
  linkedin_url: string | null;
  email: string | null;
  connected_on: string | null;
}

export async function importContactsFromCsv(csv: string): Promise<{ imported: number }> {
  const response = await fetch(`${API_BASE}/api/warm-path/contacts/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ csv }),
  });

  if (!response.ok) {
    throw new Error(`Failed to import contacts (${response.status})`);
  }

  return response.json();
}

export async function listContacts(company?: string): Promise<ContactRecord[]> {
  const search = new URLSearchParams();
  if (company) {
    search.set("company", company);
  }

  const response = await fetch(`${API_BASE}/api/warm-path/contacts?${search.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to list contacts (${response.status})`);
  }

  const payload = (await response.json()) as { contacts: ContactRecord[] };
  return payload.contacts;
}

export async function runSecondDegreeScout(
  input: SecondDegreeScoutRequest
): Promise<RunSecondDegreeScoutResponse> {
  const response = await fetch(`${API_BASE}/api/warm-path/scout/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(`Failed to run scout (${response.status})`);
  }

  return response.json();
}

export async function listScoutRuns(limit: number = 20): Promise<SecondDegreeScoutRun[]> {
  const response = await fetch(`${API_BASE}/api/warm-path/scout/runs?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to list scout runs (${response.status})`);
  }

  const payload = (await response.json()) as {
    runs: Array<{
      id: string;
      target_company: string;
      target_function?: string;
      target_title?: string;
      status: SecondDegreeScoutRun["status"];
      source: string;
      notes?: string;
      created_at: string;
      updated_at: string;
    }>;
  };

  return payload.runs.map((run) => ({
    ...run,
    targets: [],
    connector_paths: [],
  }));
}

export async function getScoutRun(runId: string): Promise<SecondDegreeScoutRun> {
  const response = await fetch(`${API_BASE}/api/warm-path/scout/runs/${runId}`);
  if (!response.ok) {
    throw new Error(`Failed to get scout run (${response.status})`);
  }

  const payload = (await response.json()) as { run: SecondDegreeScoutRun };
  return payload.run;
}

export async function getScoutStats(): Promise<ScoutRunStats> {
  const response = await fetch(`${API_BASE}/api/warm-path/scout/stats`);
  if (!response.ok) {
    throw new Error(`Failed to get scout stats (${response.status})`);
  }

  const payload = (await response.json()) as { stats: ScoutRunStats };
  return payload.stats;
}
