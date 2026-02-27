import { classifyAskType } from "./ask-type";
import { defaultWeights, scoringDimensionMax, type ScoringWeights } from "./weights";

export interface ContactSignals {
  colleagueId: string;
  name: string;
  title: string;
  companyAffinity: number;
  roleRelevance: number;
  relationshipStrength: number;
  sharedContext: number;
  confidence: number;
}

export interface RankedContact {
  colleague_id: string;
  name: string;
  total_score: number;
  company_affinity: number;
  role_relevance: number;
  relationship_strength: number;
  shared_context: number;
  confidence: number;
  recommended_ask: "context" | "intro" | "referral";
  rationale: string;
}

export function rankContacts(signals: ContactSignals[], weights: ScoringWeights = defaultWeights): RankedContact[] {
  return signals
    .map((signal) => {
      const companyAffinity = clamp(signal.companyAffinity, 0, scoringDimensionMax.companyAffinity);
      const roleRelevance = clamp(signal.roleRelevance, 0, scoringDimensionMax.roleRelevance);
      const relationshipStrength = clamp(signal.relationshipStrength, 0, scoringDimensionMax.relationshipStrength);
      const sharedContext = clamp(signal.sharedContext, 0, scoringDimensionMax.sharedContext);
      const confidence = clamp(signal.confidence, 0, scoringDimensionMax.confidence);

      const total =
        companyAffinity * (weights.companyAffinity / scoringDimensionMax.companyAffinity) +
        roleRelevance * (weights.roleRelevance / scoringDimensionMax.roleRelevance) +
        relationshipStrength * (weights.relationshipStrength / scoringDimensionMax.relationshipStrength) +
        sharedContext * (weights.sharedContext / scoringDimensionMax.sharedContext) +
        confidence * (weights.confidence / scoringDimensionMax.confidence);

      return {
        colleague_id: signal.colleagueId,
        name: signal.name,
        total_score: Number(clamp(total, 0, 100).toFixed(2)),
        company_affinity: companyAffinity,
        role_relevance: roleRelevance,
        relationship_strength: relationshipStrength,
        shared_context: sharedContext,
        confidence,
        recommended_ask: classifyAskType(signal.title),
        rationale: buildRationale(signal),
      };
    })
    .sort((a, b) => b.total_score - a.total_score);
}

function buildRationale(signal: ContactSignals): string {
  const reasons: string[] = [];

  if (signal.companyAffinity >= 25) reasons.push("strong company affinity");
  if (signal.roleRelevance >= 18) reasons.push("high role relevance");
  if (signal.relationshipStrength >= 14) reasons.push("solid relationship strength");

  if (reasons.length === 0) {
    return "Best available path with moderate confidence.";
  }

  return `Best path due to ${reasons.join(", ")}.`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
