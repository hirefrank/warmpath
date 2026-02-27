export const migrations: string[] = [
  `
  CREATE TABLE IF NOT EXISTS jobs_cache (
    id TEXT PRIMARY KEY,
    advisor_slug TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'network',
    external_job_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    company_domain TEXT,
    department TEXT,
    category TEXT,
    location TEXT,
    url TEXT NOT NULL,
    salary_min INTEGER,
    salary_max INTEGER,
    posted_at TEXT,
    first_seen TEXT,
    last_seen TEXT,
    cached_at TEXT DEFAULT (datetime('now'))
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_jobs_cache_company ON jobs_cache(company)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_cache_category ON jobs_cache(category)`,
  `
  CREATE TABLE IF NOT EXISTS warm_path_runs (
    id TEXT PRIMARY KEY,
    advisor_slug TEXT NOT NULL,
    job_cache_id TEXT,
    seeker_name TEXT,
    seeker_linkedin_url TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(job_cache_id) REFERENCES jobs_cache(id) ON DELETE SET NULL
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS warm_path_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    colleague_id TEXT NOT NULL,
    colleague_name TEXT NOT NULL,
    total_score REAL NOT NULL,
    company_affinity REAL NOT NULL,
    role_relevance REAL NOT NULL,
    relationship_strength REAL NOT NULL,
    shared_context REAL NOT NULL,
    confidence REAL NOT NULL,
    recommended_ask TEXT NOT NULL,
    rationale TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(run_id) REFERENCES warm_path_runs(id) ON DELETE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_warm_path_results_run_id ON warm_path_results(run_id)`,
  `
  CREATE TABLE IF NOT EXISTS warm_path_events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    run_id TEXT NOT NULL,
    advisor_slug TEXT NOT NULL,
    colleague_id TEXT,
    occurred_at TEXT NOT NULL
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_warm_path_events_run_id ON warm_path_events(run_id)`,
  `
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    current_title TEXT,
    current_company TEXT,
    linkedin_url TEXT,
    email TEXT,
    connected_on TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(current_company)`,
  `
  CREATE TABLE IF NOT EXISTS second_degree_scout_runs (
    id TEXT PRIMARY KEY,
    target_company TEXT NOT NULL,
    target_function TEXT,
    target_title TEXT,
    status TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'linkedin_li_at',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_second_degree_runs_company ON second_degree_scout_runs(target_company)`,
  `
  CREATE TABLE IF NOT EXISTS second_degree_targets (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    full_name TEXT NOT NULL,
    headline TEXT,
    current_company TEXT,
    current_title TEXT,
    linkedin_url TEXT,
    confidence REAL NOT NULL DEFAULT 0,
    match_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(run_id) REFERENCES second_degree_scout_runs(id) ON DELETE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_second_degree_targets_run_id ON second_degree_targets(run_id)`,
  `
  CREATE TABLE IF NOT EXISTS connector_paths (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    connector_contact_id TEXT,
    connector_name TEXT NOT NULL,
    connector_strength REAL NOT NULL DEFAULT 0,
    path_score REAL NOT NULL DEFAULT 0,
    rationale TEXT,
    recommended_ask TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(run_id) REFERENCES second_degree_scout_runs(id) ON DELETE CASCADE,
    FOREIGN KEY(target_id) REFERENCES second_degree_targets(id) ON DELETE CASCADE,
    FOREIGN KEY(connector_contact_id) REFERENCES contacts(id) ON DELETE SET NULL
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_connector_paths_run_id ON connector_paths(run_id)`,
  `
  CREATE TABLE IF NOT EXISTS connector_path_scores (
    path_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    scoring_version TEXT NOT NULL,
    company_alignment REAL NOT NULL DEFAULT 0,
    role_alignment REAL NOT NULL DEFAULT 0,
    relationship REAL NOT NULL DEFAULT 0,
    connector_influence REAL NOT NULL DEFAULT 0,
    target_confidence REAL NOT NULL DEFAULT 0,
    ask_fit REAL NOT NULL DEFAULT 0,
    safety REAL NOT NULL DEFAULT 0,
    total_before_guardrails REAL NOT NULL DEFAULT 0,
    guardrail_penalty REAL NOT NULL DEFAULT 0,
    quality_tier TEXT NOT NULL DEFAULT 'low',
    guardrail_adjustments TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(path_id) REFERENCES connector_paths(id) ON DELETE CASCADE,
    FOREIGN KEY(run_id) REFERENCES second_degree_scout_runs(id) ON DELETE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_connector_path_scores_run_id ON connector_path_scores(run_id)`,
  `
  CREATE TABLE IF NOT EXISTS scout_run_diagnostics (
    run_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    used_seed_targets INTEGER NOT NULL DEFAULT 0,
    requested_limit INTEGER NOT NULL,
    effective_limit INTEGER NOT NULL,
    min_confidence REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(run_id) REFERENCES second_degree_scout_runs(id) ON DELETE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS scout_adapter_attempts (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    adapter TEXT NOT NULL,
    status TEXT NOT NULL,
    result_count INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(run_id) REFERENCES second_degree_scout_runs(id) ON DELETE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_scout_adapter_attempts_run_id ON scout_adapter_attempts(run_id)`,
  `
  CREATE TABLE IF NOT EXISTS outreach_workflow_entries (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    colleague_id TEXT NOT NULL,
    status TEXT NOT NULL,
    channel TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(run_id) REFERENCES warm_path_runs(id) ON DELETE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_outreach_workflow_run_id ON outreach_workflow_entries(run_id)`,
  `
  CREATE TABLE IF NOT EXISTS outreach_reminders (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    colleague_id TEXT NOT NULL,
    due_at TEXT NOT NULL,
    channel TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(run_id) REFERENCES warm_path_runs(id) ON DELETE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_outreach_reminders_run_id ON outreach_reminders(run_id)`,
  `
  CREATE TABLE IF NOT EXISTS learning_feedback (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    colleague_id TEXT NOT NULL,
    outcome TEXT NOT NULL,
    note TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(run_id) REFERENCES warm_path_runs(id) ON DELETE CASCADE
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_learning_feedback_run_id ON learning_feedback(run_id)`,
  `
  CREATE TABLE IF NOT EXISTS learning_weight_profiles (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    source TEXT NOT NULL,
    company_affinity REAL NOT NULL,
    role_relevance REAL NOT NULL,
    relationship_strength REAL NOT NULL,
    shared_context REAL NOT NULL,
    confidence REAL NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 0,
    activated_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
  )
  `,
  `CREATE INDEX IF NOT EXISTS idx_learning_weight_profiles_active ON learning_weight_profiles(is_active)`,
  `
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )
  `,
];
