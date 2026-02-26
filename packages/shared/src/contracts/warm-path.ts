export type RecommendedAsk = "context" | "intro" | "referral";

export interface WarmPathRankRequest {
  advisor_slug: string;
  job_cache_id: string;
  seeker_name?: string;
  seeker_linkedin_url?: string;
}

export interface RankedPath {
  colleague_id: string;
  name: string;
  total_score: number;
  company_affinity: number;
  role_relevance: number;
  relationship_strength: number;
  shared_context: number;
  confidence: number;
  recommended_ask: RecommendedAsk;
  rationale: string;
}

export interface WarmPathRankResponse {
  run_id: string;
  top_paths: RankedPath[];
}

export interface IntroDraftRequest {
  colleague_id: string;
  resume_text?: string;
  extra_context?: string;
}

export interface IntroDraftResponse {
  subject: string;
  forwardable_email: string;
  short_dm: string;
  follow_up_sequence: string[];
}

export type WarmPathEventName =
  | "warm_path_ranked"
  | "intro_draft_generated"
  | "outreach_sent"
  | "outreach_replied"
  | "intro_accepted"
  | "scout_run_started"
  | "scout_run_completed"
  | "scout_run_failed"
  | "scout_needs_adapter";

export interface WarmPathEvent {
  name: WarmPathEventName;
  run_id: string;
  advisor_slug: string;
  colleague_id?: string;
  occurred_at: string;
}
