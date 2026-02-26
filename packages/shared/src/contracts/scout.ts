export interface SecondDegreeScoutRequest {
  target_company: string;
  target_function?: string;
  target_title?: string;
  limit?: number;
  seed_targets?: ScoutSeedTarget[];
}

export interface ScoutSeedTarget {
  full_name: string;
  current_title?: string;
  current_company?: string;
  linkedin_url?: string;
  confidence?: number;
}

export interface ScoutAdapterAttempt {
  adapter: string;
  status: "not_configured" | "no_results" | "success" | "error";
  result_count: number;
  error?: string;
}

export interface ScoutRunDiagnostics {
  run_id: string;
  source: string;
  used_seed_targets: boolean;
  requested_limit: number;
  effective_limit: number;
  min_confidence: number;
  adapter_attempts: ScoutAdapterAttempt[];
}

export interface SecondDegreeTarget {
  id: string;
  run_id: string;
  full_name: string;
  headline?: string;
  current_company?: string;
  current_title?: string;
  linkedin_url?: string;
  confidence: number;
  match_reason?: string;
}

export interface ConnectorPath {
  id: string;
  run_id: string;
  target_id: string;
  connector_contact_id?: string;
  connector_name: string;
  connector_strength: number;
  path_score: number;
  rationale?: string;
  recommended_ask?: "context" | "intro" | "referral";
}

export interface SecondDegreeScoutRun {
  id: string;
  target_company: string;
  target_function?: string;
  target_title?: string;
  status: "pending" | "running" | "completed" | "needs_adapter" | "failed";
  source: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  targets: SecondDegreeTarget[];
  connector_paths: ConnectorPath[];
}

export interface ScoutRunStats {
  total: number;
  by_status: Record<string, number>;
  by_source: Record<string, number>;
  latest_run_at: string | null;
}

export interface RunSecondDegreeScoutResponse {
  run: SecondDegreeScoutRun;
  notes?: string;
  diagnostics: ScoutRunDiagnostics;
}
