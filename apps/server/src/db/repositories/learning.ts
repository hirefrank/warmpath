import type { Database } from "bun:sqlite";
import {
  defaultWeights,
  normalizeWeights,
  scoringDimensionMax,
  type ScoringWeights,
} from "../../lib/scoring/weights";
import type {
  LearningFeedback,
  LearningOutcome,
  LearningSummaryResponse,
  LearningWeightProfile,
} from "../../../../../packages/shared/src/contracts/warm-path";

interface LearningFeedbackRow {
  id: string;
  run_id: string;
  colleague_id: string;
  outcome: LearningOutcome;
  note: string | null;
  source: "workflow" | "manual";
  created_at: string;
}

interface LearningWeightProfileRow {
  id: string;
  label: string;
  source: "default" | "auto_tuned" | "manual";
  company_affinity: number;
  role_relevance: number;
  relationship_strength: number;
  shared_context: number;
  confidence: number;
  sample_size: number;
  activated_at: string;
}

interface LearningSampleRow {
  company_affinity: number;
  role_relevance: number;
  relationship_strength: number;
  shared_context: number;
  confidence: number;
  outcome: LearningOutcome;
}

export function ensureDefaultLearningProfile(database: Database): LearningWeightProfile {
  const active = getActiveLearningProfile(database);
  if (active) {
    return active;
  }

  return createLearningWeightProfile(database, {
    label: "Default scoring profile",
    source: "default",
    weights: defaultWeights,
    sampleSize: 0,
    activate: true,
  });
}

export function getActiveLearningProfile(database: Database): LearningWeightProfile | null {
  const row = database
    .query(
      `
      SELECT id, label, source, company_affinity, role_relevance, relationship_strength,
             shared_context, confidence, sample_size, activated_at
      FROM learning_weight_profiles
      WHERE is_active = 1
      ORDER BY activated_at DESC
      LIMIT 1
      `
    )
    .get() as LearningWeightProfileRow | null;

  return row ? mapProfileRow(row) : null;
}

export function getActiveScoringWeights(database: Database): ScoringWeights {
  const profile = ensureDefaultLearningProfile(database);
  return {
    companyAffinity: profile.weights.company_affinity,
    roleRelevance: profile.weights.role_relevance,
    relationshipStrength: profile.weights.relationship_strength,
    sharedContext: profile.weights.shared_context,
    confidence: profile.weights.confidence,
  };
}

export function createLearningWeightProfile(
  database: Database,
  input: {
    label: string;
    source: "default" | "auto_tuned" | "manual";
    weights: ScoringWeights;
    sampleSize: number;
    activate: boolean;
  }
): LearningWeightProfile {
  const id = crypto.randomUUID();
  const activatedAt = new Date().toISOString();
  const normalized = normalizeWeights(input.weights);

  const transaction = database.transaction(() => {
    if (input.activate) {
      database.query("UPDATE learning_weight_profiles SET is_active = 0 WHERE is_active = 1").run();
    }

    database
      .query(
        `
        INSERT INTO learning_weight_profiles (
          id, label, source, company_affinity, role_relevance, relationship_strength,
          shared_context, confidence, sample_size, is_active, activated_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        id,
        input.label,
        input.source,
        normalized.companyAffinity,
        normalized.roleRelevance,
        normalized.relationshipStrength,
        normalized.sharedContext,
        normalized.confidence,
        input.sampleSize,
        input.activate ? 1 : 0,
        activatedAt,
        activatedAt
      );
  });

  transaction();

  return {
    id,
    label: input.label,
    source: input.source,
    weights: {
      company_affinity: normalized.companyAffinity,
      role_relevance: normalized.roleRelevance,
      relationship_strength: normalized.relationshipStrength,
      shared_context: normalized.sharedContext,
      confidence: normalized.confidence,
    },
    sample_size: input.sampleSize,
    activated_at: activatedAt,
  };
}

export function recordLearningFeedback(
  database: Database,
  input: {
    runId: string;
    colleagueId: string;
    outcome: LearningOutcome;
    note?: string;
    source: "workflow" | "manual";
  }
): LearningFeedback {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  database
    .query(
      `
      INSERT INTO learning_feedback (id, run_id, colleague_id, outcome, note, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(id, input.runId, input.colleagueId, input.outcome, input.note ?? null, input.source, createdAt);

  return {
    id,
    run_id: input.runId,
    colleague_id: input.colleagueId,
    outcome: input.outcome,
    note: input.note,
    source: input.source,
    created_at: createdAt,
  };
}

export function buildLearningSummary(database: Database): LearningSummaryResponse {
  const activeProfile = ensureDefaultLearningProfile(database);
  const recentFeedbackRows = database
    .query(
      `
      SELECT id, run_id, colleague_id, outcome, note, source, created_at
      FROM learning_feedback
      ORDER BY created_at DESC
      LIMIT 25
      `
    )
    .all() as LearningFeedbackRow[];

  const totalRow = database
    .query(
      `
      SELECT
        COUNT(*) AS feedback_count,
        SUM(CASE WHEN outcome IN ('intro_accepted', 'replied') THEN 1 ELSE 0 END) AS successful_outcomes
      FROM learning_feedback
      `
    )
    .get() as { feedback_count: number; successful_outcomes: number | null };

  return {
    active_profile: activeProfile,
    totals: {
      feedback_count: totalRow.feedback_count,
      successful_outcomes: totalRow.successful_outcomes ?? 0,
      recent_feedback_count: recentFeedbackRows.length,
    },
    recent_feedback: recentFeedbackRows.map(mapFeedbackRow),
  };
}

export function autoTuneLearningProfile(
  database: Database,
  minSamples: number
): { profile: LearningWeightProfile; usedSamples: number } | null {
  const rows = database
    .query(
      `
      SELECT r.company_affinity, r.role_relevance, r.relationship_strength, r.shared_context, r.confidence, f.outcome
      FROM learning_feedback f
      INNER JOIN warm_path_results r
        ON r.run_id = f.run_id
       AND r.colleague_id = f.colleague_id
      ORDER BY f.created_at DESC
      `
    )
    .all() as LearningSampleRow[];

  if (rows.length < minSamples) {
    return null;
  }

  const weightedTotals = {
    companyAffinity: 0,
    roleRelevance: 0,
    relationshipStrength: 0,
    sharedContext: 0,
    confidence: 0,
  };
  let weightAccumulator = 0;

  for (const row of rows) {
    const outcomeWeight = outcomeToScalar(row.outcome);
    const normalizedOutcomeWeight = (outcomeWeight + 1.2) / 2.2;

    weightedTotals.companyAffinity += (row.company_affinity / scoringDimensionMax.companyAffinity) * normalizedOutcomeWeight;
    weightedTotals.roleRelevance += (row.role_relevance / scoringDimensionMax.roleRelevance) * normalizedOutcomeWeight;
    weightedTotals.relationshipStrength += (row.relationship_strength / scoringDimensionMax.relationshipStrength) * normalizedOutcomeWeight;
    weightedTotals.sharedContext += (row.shared_context / scoringDimensionMax.sharedContext) * normalizedOutcomeWeight;
    weightedTotals.confidence += (row.confidence / scoringDimensionMax.confidence) * normalizedOutcomeWeight;
    weightAccumulator += normalizedOutcomeWeight;
  }

  if (weightAccumulator <= 0) {
    return null;
  }

  const candidate = normalizeWeights({
    companyAffinity: Math.max(8, (weightedTotals.companyAffinity / weightAccumulator) * 100),
    roleRelevance: Math.max(8, (weightedTotals.roleRelevance / weightAccumulator) * 100),
    relationshipStrength: Math.max(8, (weightedTotals.relationshipStrength / weightAccumulator) * 100),
    sharedContext: Math.max(8, (weightedTotals.sharedContext / weightAccumulator) * 100),
    confidence: Math.max(5, (weightedTotals.confidence / weightAccumulator) * 100),
  });

  const profile = createLearningWeightProfile(database, {
    label: `Auto-tuned profile (${rows.length} samples)`,
    source: "auto_tuned",
    weights: candidate,
    sampleSize: rows.length,
    activate: true,
  });

  return {
    profile,
    usedSamples: rows.length,
  };
}

function mapProfileRow(row: LearningWeightProfileRow): LearningWeightProfile {
  return {
    id: row.id,
    label: row.label,
    source: row.source,
    weights: {
      company_affinity: row.company_affinity,
      role_relevance: row.role_relevance,
      relationship_strength: row.relationship_strength,
      shared_context: row.shared_context,
      confidence: row.confidence,
    },
    sample_size: row.sample_size,
    activated_at: row.activated_at,
  };
}

function mapFeedbackRow(row: LearningFeedbackRow): LearningFeedback {
  return {
    id: row.id,
    run_id: row.run_id,
    colleague_id: row.colleague_id,
    outcome: row.outcome,
    note: row.note ?? undefined,
    source: row.source,
    created_at: row.created_at,
  };
}

function outcomeToScalar(outcome: LearningOutcome): number {
  switch (outcome) {
    case "intro_accepted":
      return 1;
    case "replied":
      return 0.7;
    case "sent":
      return 0.35;
    case "follow_up_sent":
      return 0.2;
    case "no_response":
      return -0.25;
    case "not_interested":
      return -0.6;
    default:
      return 0;
  }
}
