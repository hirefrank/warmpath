import type { NormalizedJob } from "@warmpath/shared/contracts/job";
import type {
  GetScoutRunResponse,
  RunSecondDegreeScoutResponse,
  ScoutRunStats,
  SecondDegreeScoutRequest,
  SecondDegreeScoutRun,
} from "@warmpath/shared/contracts/scout";
import type {
  AutoTuneResponse,
  DistributionPackResponse,
  IntroDraftResponse,
  LearningOutcome,
  LearningSummaryResponse,
  LearningWeightProfile,
  MessageChannel,
  MessagePackResponse,
  OutreachWorkflowStatus,
  OutreachBriefResponse,
  RankedPath,
  Reminder,
  WorkflowSnapshotResponse,
} from "@warmpath/shared/contracts/warm-path";

const API_BASE = "";

interface ApiErrorShape {
  error?: string;
  details?: string;
}

async function assertOk(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) {
    return;
  }

  let message = `${fallbackMessage} (${response.status})`;

  try {
    const payload = (await response.json()) as ApiErrorShape;
    if (payload.error && payload.details) {
      message = `${payload.error}: ${payload.details}`;
    } else if (payload.error) {
      message = payload.error;
    }
  } catch {
    // Response body may be empty/non-JSON.
  }

  throw new Error(message);
}

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

  await assertOk(response, "Failed to sync jobs");

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
  await assertOk(response, "Failed to list jobs");

  const payload = (await response.json()) as { jobs: NormalizedJob[] };
  return payload.jobs;
}

export async function rankWarmPaths(input: {
  advisor_slug: string;
  job_cache_id: string;
}): Promise<{ run_id: string; top_paths: RankedPath[]; weight_profile?: LearningWeightProfile }> {
  const response = await fetch(`${API_BASE}/api/warm-path/rank`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  await assertOk(response, "Failed to rank warm paths");

  return response.json();
}

export async function draftIntro(input: {
  run_id: string;
  colleague_id: string;
  extra_context?: string;
  tone?: "warm" | "concise" | "direct";
}): Promise<IntroDraftResponse> {
  const response = await fetch(`${API_BASE}/api/warm-path/runs/${input.run_id}/intro-draft`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      colleague_id: input.colleague_id,
      extra_context: input.extra_context,
      tone: input.tone,
    }),
  });

  await assertOk(response, "Failed to generate draft");

  return response.json();
}

export async function generateOutreachBrief(input: {
  run_id: string;
  colleague_id: string;
  extra_context?: string;
  tone?: "warm" | "concise" | "direct";
}): Promise<OutreachBriefResponse> {
  const response = await fetch(`${API_BASE}/api/warm-path/runs/${input.run_id}/outreach-brief`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      colleague_id: input.colleague_id,
      extra_context: input.extra_context,
      tone: input.tone,
    }),
  });

  await assertOk(response, "Failed to generate outreach brief");

  return response.json();
}

export async function generateMessagePack(input: {
  run_id: string;
  colleague_id: string;
  extra_context?: string;
  tone?: "warm" | "concise" | "direct";
}): Promise<MessagePackResponse> {
  const response = await fetch(`${API_BASE}/api/warm-path/runs/${input.run_id}/message-pack`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      colleague_id: input.colleague_id,
      extra_context: input.extra_context,
      tone: input.tone,
    }),
  });

  await assertOk(response, "Failed to generate message pack");

  return response.json();
}

export async function getWorkflowSnapshot(input: {
  run_id: string;
  colleague_id: string;
}): Promise<WorkflowSnapshotResponse> {
  const search = new URLSearchParams({ colleague_id: input.colleague_id });
  const response = await fetch(`${API_BASE}/api/warm-path/runs/${input.run_id}/workflow?${search.toString()}`);

  await assertOk(response, "Failed to load workflow snapshot");

  return response.json();
}

export async function trackWorkflowStatus(input: {
  run_id: string;
  colleague_id: string;
  status: OutreachWorkflowStatus;
  channel?: MessageChannel;
  note?: string;
}): Promise<{ snapshot: WorkflowSnapshotResponse }> {
  const response = await fetch(`${API_BASE}/api/warm-path/runs/${input.run_id}/workflow/track`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      colleague_id: input.colleague_id,
      status: input.status,
      channel: input.channel,
      note: input.note,
    }),
  });

  await assertOk(response, "Failed to track workflow status");

  return response.json();
}

export async function scheduleReminder(input: {
  run_id: string;
  colleague_id: string;
  message: string;
  channel?: MessageChannel;
  due_at?: string;
  offset_days?: number;
}): Promise<{ reminder: Reminder; snapshot: WorkflowSnapshotResponse }> {
  const response = await fetch(`${API_BASE}/api/warm-path/runs/${input.run_id}/reminders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      colleague_id: input.colleague_id,
      message: input.message,
      channel: input.channel,
      due_at: input.due_at,
      offset_days: input.offset_days,
    }),
  });

  await assertOk(response, "Failed to schedule reminder");

  return response.json();
}

export async function updateReminder(input: {
  run_id: string;
  reminder_id: string;
  status: "pending" | "completed" | "cancelled";
}): Promise<{ reminder: Reminder; snapshot: WorkflowSnapshotResponse }> {
  const response = await fetch(`${API_BASE}/api/warm-path/runs/${input.run_id}/reminders/${input.reminder_id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status: input.status }),
  });

  await assertOk(response, "Failed to update reminder");

  return response.json();
}

export async function getLearningSummary(): Promise<LearningSummaryResponse> {
  const response = await fetch(`${API_BASE}/api/warm-path/learning/summary`);
  await assertOk(response, "Failed to load learning summary");

  return response.json();
}

export async function recordLearningFeedback(input: {
  run_id: string;
  colleague_id: string;
  outcome: LearningOutcome;
  note?: string;
}): Promise<{ summary: LearningSummaryResponse }> {
  const response = await fetch(`${API_BASE}/api/warm-path/learning/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  await assertOk(response, "Failed to record learning feedback");

  return response.json();
}

export async function autoTuneLearning(minSamples: number = 5): Promise<AutoTuneResponse> {
  const response = await fetch(`${API_BASE}/api/warm-path/learning/auto-tune`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ min_samples: minSamples }),
  });

  await assertOk(response, "Failed to auto-tune learning profile");

  return response.json();
}

export async function generateDistributionPack(input: {
  run_id: string;
  colleague_id: string;
  extra_context?: string;
  tone?: "warm" | "concise" | "direct";
}): Promise<DistributionPackResponse> {
  const response = await fetch(`${API_BASE}/api/warm-path/runs/${input.run_id}/distribution-pack`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      colleague_id: input.colleague_id,
      extra_context: input.extra_context,
      tone: input.tone,
    }),
  });

  await assertOk(response, "Failed to generate distribution pack");

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

  await assertOk(response, "Failed to import contacts");

  return response.json();
}

export async function listContacts(company?: string): Promise<ContactRecord[]> {
  const search = new URLSearchParams();
  if (company) {
    search.set("company", company);
  }

  const response = await fetch(`${API_BASE}/api/warm-path/contacts?${search.toString()}`);
  await assertOk(response, "Failed to list contacts");

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

  await assertOk(response, "Failed to run scout");

  return response.json();
}

export async function listScoutRuns(limit: number = 20): Promise<SecondDegreeScoutRun[]> {
  const response = await fetch(`${API_BASE}/api/warm-path/scout/runs?limit=${limit}`);
  await assertOk(response, "Failed to list scout runs");

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
      diagnostics_summary?: SecondDegreeScoutRun["diagnostics_summary"];
    }>;
  };

  return payload.runs.map((run) => ({
    ...run,
    targets: [],
    connector_paths: [],
  }));
}

export async function getScoutRun(runId: string): Promise<GetScoutRunResponse> {
  const response = await fetch(`${API_BASE}/api/warm-path/scout/runs/${runId}`);
  await assertOk(response, "Failed to get scout run");

  return response.json();
}

export async function getScoutStats(): Promise<ScoutRunStats> {
  const response = await fetch(`${API_BASE}/api/warm-path/scout/stats`);
  await assertOk(response, "Failed to get scout stats");

  const payload = (await response.json()) as { stats: ScoutRunStats };
  return payload.stats;
}
