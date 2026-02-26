import type { Database } from "bun:sqlite";
import type {
  ConnectorPath,
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
      });
    }
  });

  transaction(paths);
  return saved;
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
    connector_paths: connectorPaths,
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
