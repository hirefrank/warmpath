export interface ScoringWeights {
  companyAffinity: number;
  roleRelevance: number;
  relationshipStrength: number;
  sharedContext: number;
  confidence: number;
}

export const scoringDimensionMax = {
  companyAffinity: 35,
  roleRelevance: 25,
  relationshipStrength: 20,
  sharedContext: 15,
  confidence: 5,
} as const;

export const defaultWeights: ScoringWeights = {
  companyAffinity: 35,
  roleRelevance: 25,
  relationshipStrength: 20,
  sharedContext: 15,
  confidence: 5,
};

export function normalizeWeights(weights: ScoringWeights): ScoringWeights {
  const total = weights.companyAffinity +
    weights.roleRelevance +
    weights.relationshipStrength +
    weights.sharedContext +
    weights.confidence;

  if (total <= 0) {
    return { ...defaultWeights };
  }

  return {
    companyAffinity: Number(((weights.companyAffinity / total) * 100).toFixed(2)),
    roleRelevance: Number(((weights.roleRelevance / total) * 100).toFixed(2)),
    relationshipStrength: Number(((weights.relationshipStrength / total) * 100).toFixed(2)),
    sharedContext: Number(((weights.sharedContext / total) * 100).toFixed(2)),
    confidence: Number(((weights.confidence / total) * 100).toFixed(2)),
  };
}
