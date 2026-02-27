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
  weight_profile?: LearningWeightProfile;
}

export interface LearningWeightProfile {
  id: string;
  label: string;
  source: "default" | "auto_tuned" | "manual";
  weights: {
    company_affinity: number;
    role_relevance: number;
    relationship_strength: number;
    shared_context: number;
    confidence: number;
  };
  sample_size: number;
  activated_at: string;
}

export type LearningOutcome =
  | "intro_accepted"
  | "replied"
  | "sent"
  | "follow_up_sent"
  | "no_response"
  | "not_interested";

export interface LearningFeedback {
  id: string;
  run_id: string;
  colleague_id: string;
  outcome: LearningOutcome;
  note?: string;
  source: "workflow" | "manual";
  created_at: string;
}

export interface LearningSummaryResponse {
  active_profile: LearningWeightProfile;
  totals: {
    feedback_count: number;
    successful_outcomes: number;
    recent_feedback_count: number;
  };
  recent_feedback: LearningFeedback[];
}

export interface RecordLearningFeedbackRequest {
  run_id: string;
  colleague_id: string;
  outcome: LearningOutcome;
  note?: string;
}

export interface AutoTuneRequest {
  min_samples?: number;
}

export interface AutoTuneResponse {
  profile: LearningWeightProfile;
  used_samples: number;
}

export type DistributionMode = "json_bundle" | "markdown_playbook" | "crm_note";

export interface DistributionArtifact {
  mode: DistributionMode;
  title: string;
  content_type: "application/json" | "text/markdown" | "text/plain";
  body: string;
}

export interface DistributionPackResponse {
  run_id: string;
  colleague_id: string;
  generated_at: string;
  artifacts: DistributionArtifact[];
}

export interface WarmPathSettings {
  advisor_slug: string;
  default_job_category: string;
  linkedin_li_at: string;
  linkedin_rate_limit_ms: number;
  linkedin_request_timeout_ms: number;
  scout_min_target_confidence: number;
  scout_provider_order: string;
  scout_static_targets_json: string;
}

export interface WarmPathSettingsResponse {
  settings: WarmPathSettings;
  hints: {
    linkedin_configured: boolean;
    static_seed_configured: boolean;
  };
}

export interface WarmPathSettingsUpdateRequest {
  settings: Partial<WarmPathSettings>;
}

export interface IntroDraftRequest {
  colleague_id: string;
  resume_text?: string;
  extra_context?: string;
}

export type OutreachTone = "warm" | "concise" | "direct";

export interface OutreachBriefRequest {
  colleague_id: string;
  extra_context?: string;
  tone?: OutreachTone;
}

export interface OutreachBriefResponse {
  run_id: string;
  colleague_id: string;
  ask_type: RecommendedAsk;
  tone: OutreachTone;
  objective: string;
  reason_to_reach_out: string;
  job: {
    company: string;
    role: string;
  };
  connector: {
    name: string;
    rationale: string;
    total_score: number;
    confidence: number;
  };
  evidence: string[];
  talking_points: string[];
  message_plan: {
    email_subject_options: string[];
    dm_hook: string;
    follow_up_sequence: string[];
  };
  applied_context?: string;
  safety_warnings?: string[];
}

export type MessageChannel = "email" | "dm";

export interface MessageVariant {
  id: string;
  channel: MessageChannel;
  label: string;
  subject?: string;
  body: string;
}

export interface FollowUpStep {
  day: number;
  channel: MessageChannel;
  guidance: string;
}

export interface MessagePackRequest {
  colleague_id: string;
  extra_context?: string;
  tone?: OutreachTone;
}

export interface MessagePackResponse {
  run_id: string;
  colleague_id: string;
  brief: OutreachBriefResponse;
  message_variants: MessageVariant[];
  follow_up_plan: FollowUpStep[];
  applied_context?: string;
  safety_warnings?: string[];
}

export interface IntroDraftResponse {
  subject: string;
  forwardable_email: string;
  short_dm: string;
  follow_up_sequence: string[];
  brief?: OutreachBriefResponse;
  message_pack?: MessagePackResponse;
  applied_context?: string;
  safety_warnings?: string[];
}

export type WarmPathEventName =
  | "warm_path_ranked"
  | "outreach_brief_generated"
  | "message_pack_generated"
  | "intro_draft_generated"
  | "workflow_status_updated"
  | "reminder_scheduled"
  | "learning_feedback_recorded"
  | "learning_profile_activated"
  | "distribution_pack_generated"
  | "outreach_sent"
  | "outreach_replied"
  | "intro_accepted"
  | "scout_run_started"
  | "scout_run_completed"
  | "scout_run_failed"
  | "scout_needs_adapter";

export type OutreachWorkflowStatus =
  | "drafted"
  | "sent"
  | "follow_up_due"
  | "follow_up_sent"
  | "replied"
  | "intro_accepted"
  | "closed";

export interface WorkflowEntry {
  id: string;
  run_id: string;
  colleague_id: string;
  status: OutreachWorkflowStatus;
  channel?: MessageChannel;
  note?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  run_id: string;
  colleague_id: string;
  due_at: string;
  channel: MessageChannel;
  message: string;
  status: "pending" | "completed" | "cancelled";
  created_at: string;
}

export interface TrackWorkflowRequest {
  colleague_id: string;
  status: OutreachWorkflowStatus;
  channel?: MessageChannel;
  note?: string;
}

export interface ScheduleReminderRequest {
  colleague_id: string;
  due_at?: string;
  offset_days?: number;
  channel?: MessageChannel;
  message: string;
}

export interface UpdateReminderRequest {
  status: "pending" | "completed" | "cancelled";
}

export interface WorkflowSnapshotResponse {
  run_id: string;
  colleague_id: string;
  latest_status: OutreachWorkflowStatus | null;
  timeline: WorkflowEntry[];
  reminders: Reminder[];
}

export interface WarmPathEvent {
  name: WarmPathEventName;
  run_id: string;
  advisor_slug: string;
  colleague_id?: string;
  occurred_at: string;
}
