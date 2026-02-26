export interface ScoringWeights {
  companyAffinity: number;
  roleRelevance: number;
  relationshipStrength: number;
  sharedContext: number;
  confidence: number;
}

export const defaultWeights: ScoringWeights = {
  companyAffinity: 35,
  roleRelevance: 25,
  relationshipStrength: 20,
  sharedContext: 15,
  confidence: 5,
};
