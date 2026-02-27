import type { Database } from "bun:sqlite";
import type {
  ConnectorPath,
  ConnectorPathScoreBreakdown,
  ScoutAdapterAttempt,
  ScoutDiagnosticsSummary,
  ScoutRunDiagnostics,
  SecondDegreeScoutRun,
  SecondDegreeTarget,
} from "../../../../../packages/shared/src/contracts/scout";

type ScoutRunStatus = SecondDegreeScoutRun["status"];

interface ScoutRunRow {
  id: string;
  target_company: string;
  target_function: string | null;
  target_title: string | null;
  status: ScoutRunStatus;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ScoutRunDiagnosticsRow {
  run_id: string;
  source: string;
  used_seed_targets: number;
  requested_limit: number;
  effective_limit: number;
  min_confidence: number;
}

interface ScoutAdapterAttemptRow {
  adapter: string;
  status: ScoutAdapterAttempt["status"];
  result_count: number;
  error: string | null;
}

interface ConnectorPathScoreRow {
  path_id: string;
  scoring_version: string;
  company_alignment: number;
  role_alignment: number;
  relationship: number;
  connector_influence: number;
  target_confidence: number;
  ask_fit: number;
  safety: number;
  total_before_guardrails: number;
  guardrail_penalty: number;
  quality_tier: "high" | "medium" | "low";
  guardrail_adjustments: string | null;
}

interface ScoutAdapterSummaryRow {
  run_id: string;
  adapter_count: number;
  success_count: number;
  error_count: number;
  not_configured_count: number;
}

interface ScoutDiagnosticsSourceRow {
  run_id: string;
  source: string;
}

export interface ScoutRunStats {
  total: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  latest_run_at: string | null;
}

interface ScoutTargetInput {
  full_name: string;
  headline?: string;
  current_company?: string;
  current_title?: string;
  linkedin_url?: string;
  confidence?: number;
  match_reason?: string;
}

interface ConnectorPathInput {
  target_id: string;
  connector_contact_id?: string;
  connector_name: string;
  connector_strength: number;
  path_score: number;
  rationale?: string;
  recommended_ask?: "context" | "intro" | "referral";
  score_breakdown?: ConnectorPathScoreBreakdown;
}

export function createScoutRun(
  database: Database,
  input: {
    runId: string;
    targetCompany: string;
    targetFunction?: string;
    targetTitle?: string;
    source: string;
    status: ScoutRunStatus;
    notes?: string;
  }
): void {
  (database.query<unknown, any[]>(
    `
    INSERT INTO second_degree_scout_runs (
      id, target_company, target_function, target_title, status, source, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `
  ) as any).run(
    input.runId,
    input.targetCompany,
    input.targetFunction ?? null,
    input.targetTitle ?? null,
    input.status,
    input.source,
    input.notes ?? null
  );
}

export function updateScoutRunStatus(
  database: Database,
  runId: string,
  status: ScoutRunStatus,
  notes?: string,
  source?: string
): void {
  (database.query<unknown, any[]>(
    `
    UPDATE second_degree_scout_runs
    SET status = ?, notes = COALESCE(?, notes), source = COALESCE(?, source), updated_at = datetime('now')
    WHERE id = ?
    `
  ) as any).run(status, notes ?? null, source ?? null, runId);
}

export function saveScoutTargets(
  database: Database,
  runId: string,
  targets: ScoutTargetInput[]
): SecondDegreeTarget[] {
  if (targets.length === 0) {
    return [];
  }

  const insert = (database.query<unknown, any[]>(
    `
    INSERT INTO second_degree_targets (
      id, run_id, full_name, headline, current_company, current_title, linkedin_url, confidence, match_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `
  ) as any);

  const saved: SecondDegreeTarget[] = [];
  const transaction = database.transaction((items: ScoutTargetInput[]) => {
    for (const item of items) {
      const id = crypto.randomUUID();
      const confidence = Math.max(0, Math.min(1, item.confidence ?? 0.6));

      insert.run(
        id,
        runId,
        item.full_name,
        item.headline ?? null,
        item.current_company ?? null,
        item.current_title ?? null,
        item.linkedin_url ?? null,
        confidence,
        item.match_reason ?? null
      );

      saved.push({
        id,
        run_id: runId,
        full_name: item.full_name,
        headline: item.headline,
        current_company: item.current_company,
        current_title: item.current_title,
        linkedin_url: item.linkedin_url,
        confidence,
        match_reason: item.match_reason,
      });
    }
  });

  transaction(targets);
  return saved;
}

export function saveConnectorPaths(
  database: Database,
  runId: string,
  paths: ConnectorPathInput[]
): ConnectorPath[] {
  if (paths.length === 0) {
    return [];
  }

  const insert = (database.query<unknown, any[]>(
    `
    INSERT INTO connector_paths (
      id, run_id, target_id, connector_contact_id, connector_name,
      connector_strength, path_score, rationale, recommended_ask, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `
  ) as any);

  const insertScoreBreakdown = (database.query<unknown, any[]>(
    `
    INSERT INTO connector_path_scores (
      path_id, run_id, scoring_version, company_alignment, role_alignment,
      relationship, connector_influence, target_confidence, ask_fit, safety,
      total_before_guardrails, guardrail_penalty, quality_tier, guardrail_adjustments, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(path_id) DO UPDATE SET
      scoring_version = excluded.scoring_version,
      company_alignment = excluded.company_alignment,
      role_alignment = excluded.role_alignment,
      relationship = excluded.relationship,
      connector_influence = excluded.connector_influence,
      target_confidence = excluded.target_confidence,
      ask_fit = excluded.ask_fit,
      safety = excluded.safety,
      total_before_guardrails = excluded.total_before_guardrails,
      guardrail_penalty = excluded.guardrail_penalty,
      quality_tier = excluded.quality_tier,
      guardrail_adjustments = excluded.guardrail_adjustments
    `
  ) as any);

  const saved: ConnectorPath[] = [];
  const transaction = database.transaction((items: ConnectorPathInput[]) => {
    for (const item of items) {
      const id = crypto.randomUUID();
      const connectorStrength = Math.max(0, Math.min(1, item.connector_strength));
      const pathScore = Math.max(0, Math.min(100, item.path_score));

      insert.run(
        id,
        runId,
        item.target_id,
        item.connector_contact_id ?? null,
        item.connector_name,
        connectorStrength,
        pathScore,
        item.rationale ?? null,
        item.recommended_ask ?? null
      );

      saved.push({
        id,
        run_id: runId,
        target_id: item.target_id,
        connector_contact_id: item.connector_contact_id,
        connector_name: item.connector_name,
        connector_strength: connectorStrength,
        path_score: pathScore,
        rationale: item.rationale,
        recommended_ask: item.recommended_ask,
        score_breakdown: item.score_breakdown,
      });

      if (item.score_breakdown) {
        insertScoreBreakdown.run(
          id,
          runId,
          item.score_breakdown.scoring_version,
          item.score_breakdown.company_alignment,
          item.score_breakdown.role_alignment,
          item.score_breakdown.relationship,
          item.score_breakdown.connector_influence,
          item.score_breakdown.target_confidence,
          item.score_breakdown.ask_fit,
          item.score_breakdown.safety,
          item.score_breakdown.total_before_guardrails,
          item.score_breakdown.guardrail_penalty,
          item.score_breakdown.quality_tier,
          JSON.stringify(item.score_breakdown.guardrail_adjustments)
        );
      }
    }
  });

  transaction(paths);
  return saved;
}

export function saveScoutDiagnostics(
  database: Database,
  diagnostics: ScoutRunDiagnostics
): void {
  (database.query<unknown, any[]>(
    `
    INSERT INTO scout_run_diagnostics (
      run_id, source, used_seed_targets, requested_limit, effective_limit, min_confidence, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(run_id) DO UPDATE SET
      source = excluded.source,
      used_seed_targets = excluded.used_seed_targets,
      requested_limit = excluded.requested_limit,
      effective_limit = excluded.effective_limit,
      min_confidence = excluded.min_confidence,
      updated_at = datetime('now')
    `
  ) as any).run(
    diagnostics.run_id,
    diagnostics.source,
    diagnostics.used_seed_targets ? 1 : 0,
    diagnostics.requested_limit,
    diagnostics.effective_limit,
    diagnostics.min_confidence
  );

  (database.query<unknown, any[]>(
    `DELETE FROM scout_adapter_attempts WHERE run_id = ?`
  ) as any).run(diagnostics.run_id);

  if (diagnostics.adapter_attempts.length === 0) {
    return;
  }

  const insertAttempt = (database.query<unknown, any[]>(
    `
    INSERT INTO scout_adapter_attempts (
      id, run_id, adapter, status, result_count, error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `
  ) as any);

  const transaction = database.transaction((attempts: ScoutAdapterAttempt[]) => {
    for (const attempt of attempts) {
      insertAttempt.run(
        crypto.randomUUID(),
        diagnostics.run_id,
        attempt.adapter,
        attempt.status,
        attempt.result_count,
        attempt.error ?? null
      );
    }
  });

  transaction(diagnostics.adapter_attempts);
}

export function getScoutDiagnosticsByRunId(
  database: Database,
  runId: string
): ScoutRunDiagnostics | null {
  const diagnosticsRow = (database.query<ScoutRunDiagnosticsRow, []>(
    `
    SELECT run_id, source, used_seed_targets, requested_limit, effective_limit, min_confidence
    FROM scout_run_diagnostics
    WHERE run_id = '${escapeSql(runId)}'
    LIMIT 1
    `
  ) as any).get() as ScoutRunDiagnosticsRow | null;

  if (!diagnosticsRow) {
    return null;
  }

  const attempts = (database.query<ScoutAdapterAttemptRow, []>(
    `
    SELECT adapter, status, result_count, error
    FROM scout_adapter_attempts
    WHERE run_id = '${escapeSql(runId)}'
    ORDER BY created_at ASC
    `
  ) as any).all() as ScoutAdapterAttemptRow[];

  return {
    run_id: diagnosticsRow.run_id,
    source: diagnosticsRow.source,
    used_seed_targets: diagnosticsRow.used_seed_targets === 1,
    requested_limit: diagnosticsRow.requested_limit,
    effective_limit: diagnosticsRow.effective_limit,
    min_confidence: diagnosticsRow.min_confidence,
    adapter_attempts: attempts.map((attempt) => ({
      adapter: attempt.adapter,
      status: attempt.status,
      result_count: attempt.result_count,
      error: attempt.error ?? undefined,
    })),
  };
}

export function listScoutDiagnosticsSummariesByRunIds(
  database: Database,
  runIds: string[]
): Record<string, ScoutDiagnosticsSummary> {
  if (runIds.length === 0) {
    return {};
  }

  const inClause = runIds.map((runId) => `'${escapeSql(runId)}'`).join(", ");
  const sourceRows = (database.query<ScoutDiagnosticsSourceRow, []>(
    `
    SELECT run_id, source
    FROM scout_run_diagnostics
    WHERE run_id IN (${inClause})
    `
  ) as any).all() as ScoutDiagnosticsSourceRow[];

  const summaryRows = (database.query<ScoutAdapterSummaryRow, []>(
    `
    SELECT
      run_id,
      COUNT(*) as adapter_count,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
      SUM(CASE WHEN status = 'not_configured' THEN 1 ELSE 0 END) as not_configured_count
    FROM scout_adapter_attempts
    WHERE run_id IN (${inClause})
    GROUP BY run_id
    `
  ) as any).all() as ScoutAdapterSummaryRow[];

  const sourceByRunId = new Map(sourceRows.map((row) => [row.run_id, row.source]));
  const summaries: Record<string, ScoutDiagnosticsSummary> = {};

  for (const row of summaryRows) {
    const source = sourceByRunId.get(row.run_id);
    if (!source) {
      continue;
    }

    summaries[row.run_id] = {
      source,
      adapter_count: row.adapter_count,
      success_count: row.success_count,
      error_count: row.error_count,
      not_configured_count: row.not_configured_count,
    };
  }

  return summaries;
}

export function getScoutRunById(database: Database, runId: string): SecondDegreeScoutRun | null {
  const run = (database.query<ScoutRunRow, []>(
    `
    SELECT id, target_company, target_function, target_title, status, source, notes, created_at, updated_at
    FROM second_degree_scout_runs
    WHERE id = '${escapeSql(runId)}'
    LIMIT 1
    `
  ) as any).get() as ScoutRunRow | null;

  if (!run) {
    return null;
  }

  const targets = (database.query<SecondDegreeTarget, []>(
    `
    SELECT id, run_id, full_name, headline, current_company, current_title, linkedin_url, confidence, match_reason
    FROM second_degree_targets
    WHERE run_id = '${escapeSql(runId)}'
    ORDER BY confidence DESC, full_name ASC
    `
  ) as any).all() as SecondDegreeTarget[];

  const connectorPaths = (database.query<ConnectorPath, []>(
    `
    SELECT id, run_id, target_id, connector_contact_id, connector_name,
           connector_strength, path_score, rationale, recommended_ask
    FROM connector_paths
    WHERE run_id = '${escapeSql(runId)}'
    ORDER BY path_score DESC, connector_strength DESC
    `
  ) as any).all() as ConnectorPath[];

  const connectorPathScores = (database.query<ConnectorPathScoreRow, []>(
    `
    SELECT
      path_id,
      scoring_version,
      company_alignment,
      role_alignment,
      relationship,
      connector_influence,
      target_confidence,
      ask_fit,
      safety,
      total_before_guardrails,
      guardrail_penalty,
      quality_tier,
      guardrail_adjustments
    FROM connector_path_scores
    WHERE run_id = '${escapeSql(runId)}'
    `
  ) as any).all() as ConnectorPathScoreRow[];

  const scoreByPathId = new Map<string, ConnectorPathScoreRow>();
  for (const score of connectorPathScores) {
    scoreByPathId.set(score.path_id, score);
  }

  const enrichedConnectorPaths = connectorPaths.map((path) => {
    const score = scoreByPathId.get(path.id);
    if (!score) {
      return path;
    }

    return {
      ...path,
      score_breakdown: {
        scoring_version: score.scoring_version,
        company_alignment: score.company_alignment,
        role_alignment: score.role_alignment,
        relationship: score.relationship,
        connector_influence: score.connector_influence,
        target_confidence: score.target_confidence,
        ask_fit: score.ask_fit,
        safety: score.safety,
        total_before_guardrails: score.total_before_guardrails,
        guardrail_penalty: score.guardrail_penalty,
        quality_tier: score.quality_tier,
        guardrail_adjustments: parseGuardrailAdjustments(score.guardrail_adjustments),
      },
    };
  });

  return {
    id: run.id,
    target_company: run.target_company,
    target_function: run.target_function ?? undefined,
    target_title: run.target_title ?? undefined,
    status: run.status,
    source: run.source,
    notes: run.notes ?? undefined,
    created_at: run.created_at,
    updated_at: run.updated_at,
    targets,
    connector_paths: enrichedConnectorPaths,
  };
}

export function listScoutRuns(database: Database, limit: number = 20): ScoutRunRow[] {
  const safeLimit = Math.max(1, Math.floor(limit));
  return (database.query<ScoutRunRow, []>(
    `
    SELECT id, target_company, target_function, target_title, status, source, notes, created_at, updated_at
    FROM second_degree_scout_runs
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
    `
  ) as any).all() as ScoutRunRow[];
}

export function getScoutRunStats(database: Database): ScoutRunStats {
  const totalRow = (database.query<{ total: number }, []>(
    `SELECT COUNT(*) as total FROM second_degree_scout_runs`
  ) as any).get() as { total: number } | null;

  const statusRows = (database.query<{ status: string; count: number }, []>(
    `
    SELECT status, COUNT(*) as count
    FROM second_degree_scout_runs
    GROUP BY status
    `
  ) as any).all() as Array<{ status: string; count: number }>;

  const sourceRows = (database.query<{ source: string; count: number }, []>(
    `
    SELECT source, COUNT(*) as count
    FROM second_degree_scout_runs
    GROUP BY source
    `
  ) as any).all() as Array<{ source: string; count: number }>;

  const latestRow = (database.query<{ latest_run_at: string | null }, []>(
    `SELECT MAX(created_at) as latest_run_at FROM second_degree_scout_runs`
  ) as any).get() as { latest_run_at: string | null } | null;

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) {
    byStatus[row.status] = row.count;
  }

  const bySource: Record<string, number> = {};
  for (const row of sourceRows) {
    bySource[row.source] = row.count;
  }

  return {
    total: totalRow?.total ?? 0,
    by_status: byStatus,
    by_source: bySource,
    latest_run_at: latestRow?.latest_run_at ?? null,
  };
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

function parseGuardrailAdjustments(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
}
