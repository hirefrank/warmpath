import type { Database } from "bun:sqlite";
import type { WarmPathEvent } from "../../../../../packages/shared/src/contracts/warm-path";
import type { RankedContact } from "../../lib/scoring/ranker";

interface WarmPathRunRow {
  id: string;
  advisor_slug: string;
  job_cache_id: string | null;
  seeker_name: string | null;
  seeker_linkedin_url: string | null;
  created_at: string;
}

interface WarmPathResultRow {
  id: string;
  run_id: string;
  colleague_id: string;
  colleague_name: string;
  total_score: number;
  company_affinity: number;
  role_relevance: number;
  relationship_strength: number;
  shared_context: number;
  confidence: number;
  recommended_ask: "context" | "intro" | "referral";
  rationale: string;
  created_at: string;
}

export interface WarmPathRunRecord {
  run_id: string;
  advisor_slug: string;
  job_cache_id: string | null;
  seeker_name: string | null;
  seeker_linkedin_url: string | null;
  created_at: string;
  top_paths: RankedContact[];
}

export function createRun(
  database: Database,
  input: {
    runId: string;
    advisorSlug: string;
    jobCacheId?: string;
    seekerName?: string;
    seekerLinkedinUrl?: string;
  }
): void {
  database
    .query(
      `
      INSERT INTO warm_path_runs (id, advisor_slug, job_cache_id, seeker_name, seeker_linkedin_url)
      VALUES (?, ?, ?, ?, ?)
      `
    )
    .run(
      input.runId,
      input.advisorSlug,
      input.jobCacheId ?? null,
      input.seekerName ?? null,
      input.seekerLinkedinUrl ?? null
    );
}

export function saveResults(database: Database, runId: string, results: RankedContact[]): void {
  const insert = database.query(
    `
    INSERT INTO warm_path_results (
      id,
      run_id,
      colleague_id,
      colleague_name,
      total_score,
      company_affinity,
      role_relevance,
      relationship_strength,
      shared_context,
      confidence,
      recommended_ask,
      rationale
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  const transaction = database.transaction((items: RankedContact[]) => {
    for (const item of items) {
      insert.run(
        crypto.randomUUID(),
        runId,
        item.colleague_id,
        item.name,
        item.total_score,
        item.company_affinity,
        item.role_relevance,
        item.relationship_strength,
        item.shared_context,
        item.confidence,
        item.recommended_ask,
        item.rationale
      );
    }
  });

  transaction(results);
}

export function getRunById(database: Database, runId: string): WarmPathRunRecord | null {
  const runRow = database
    .query(
      `
      SELECT id, advisor_slug, job_cache_id, seeker_name, seeker_linkedin_url, created_at
      FROM warm_path_runs
      WHERE id = ?
      LIMIT 1
      `
    )
    .get(runId) as WarmPathRunRow | null;

  if (!runRow) {
    return null;
  }

  const resultRows = database
    .query(
      `
      SELECT id, run_id, colleague_id, total_score, company_affinity, role_relevance,
             relationship_strength, shared_context, confidence, recommended_ask, rationale, created_at,
             colleague_name
      FROM warm_path_results
      WHERE run_id = ?
      ORDER BY total_score DESC
      `
    )
    .all(runId) as WarmPathResultRow[];

  return {
    run_id: runRow.id,
    advisor_slug: runRow.advisor_slug,
    job_cache_id: runRow.job_cache_id,
    seeker_name: runRow.seeker_name,
    seeker_linkedin_url: runRow.seeker_linkedin_url,
    created_at: runRow.created_at,
    top_paths: resultRows.map((row) => ({
      colleague_id: row.colleague_id,
      name: row.colleague_name,
      total_score: row.total_score,
      company_affinity: row.company_affinity,
      role_relevance: row.role_relevance,
      relationship_strength: row.relationship_strength,
      shared_context: row.shared_context,
      confidence: row.confidence,
      recommended_ask: row.recommended_ask,
      rationale: row.rationale,
    })),
  };
}

export function saveEvent(database: Database, event: WarmPathEvent): void {
  database
    .query(
      `
      INSERT INTO warm_path_events (id, name, run_id, advisor_slug, colleague_id, occurred_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      crypto.randomUUID(),
      event.name,
      event.run_id,
      event.advisor_slug,
      event.colleague_id ?? null,
      event.occurred_at
    );
}
