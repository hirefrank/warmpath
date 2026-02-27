import type { Database } from "bun:sqlite";
import {
  createScoutRun,
  getScoutRunById,
  saveConnectorPaths,
  saveScoutDiagnostics,
  saveScoutTargets,
  updateScoutRunStatus,
} from "../../db/repositories/second-degree-scout";
import { findContactsByCompany, listContacts } from "../../db/repositories/contacts";
import { classifyAskType } from "../scoring/ask-type";
import type {
  ConnectorPathScoreBreakdown,
  ScoutAdapterAttempt,
  ScoutRunDiagnostics,
  ScoutSeedTarget,
  SecondDegreeScoutRequest,
  SecondDegreeScoutRun,
} from "../../../../../packages/shared/src/contracts/scout";

const DEFAULT_MIN_TARGET_CONFIDENCE = 0.45;
const MAX_TARGETS_PER_RUN = 100;
const MAX_SEED_TARGETS = 100;
const MAX_CONNECTORS_PER_TARGET = 2;
const MAX_CONNECTOR_PATHS = 120;

const DEFAULT_SCOUT_V2_WEIGHTS = {
  company_alignment: 24,
  role_alignment: 18,
  relationship: 18,
  connector_influence: 14,
  target_confidence: 12,
  ask_fit: 8,
  safety: 6,
} as const;

export interface ScoutProviderTarget {
  full_name: string;
  headline?: string;
  current_company?: string;
  current_title?: string;
  linkedin_url?: string;
  confidence?: number;
  match_reason?: string;
}

export interface ScoutProvider {
  readonly name: string;
  isConfigured(): boolean;
  searchCompanySecondDegree(input: {
    targetCompany: string;
    targetFunction?: string;
    targetTitle?: string;
    limit: number;
  }): Promise<ScoutProviderTarget[]>;
}

export class NoopScoutProvider implements ScoutProvider {
  readonly name = "noop";

  isConfigured(): boolean {
    return false;
  }

  async searchCompanySecondDegree(): Promise<ScoutProviderTarget[]> {
    return [];
  }
}

export interface RunSecondDegreeScoutResult {
  run: SecondDegreeScoutRun;
  diagnostics: ScoutRunDiagnostics;
}

interface ScoutV2Weights {
  company_alignment: number;
  role_alignment: number;
  relationship: number;
  connector_influence: number;
  target_confidence: number;
  ask_fit: number;
  safety: number;
}

export interface RunSecondDegreeScoutOptions {
  minTargetConfidence?: number;
  scoutV2Weights?: Partial<ScoutV2Weights>;
}

export async function runSecondDegreeScout(
  database: Database,
  request: SecondDegreeScoutRequest,
  providers: ScoutProvider | ScoutProvider[] = [new NoopScoutProvider()],
  options: RunSecondDegreeScoutOptions = {}
): Promise<RunSecondDegreeScoutResult> {
  const runId = crypto.randomUUID();
  const limit = clampLimit(request.limit ?? 25);
  const minConfidence = options.minTargetConfidence !== undefined
    ? parseMinConfidenceValue(options.minTargetConfidence)
    : parseMinConfidence(process.env.SCOUT_MIN_TARGET_CONFIDENCE);
  const scoutV2Weights = resolveScoutV2Weights(options.scoutV2Weights);
  const providerChain = normalizeProviderChain(providers);
  const initialSource = request.seed_targets?.length ? "seed_targets" : providerChain[0]?.name ?? "noop";

  let diagnostics = createInitialDiagnostics({
    runId,
    source: initialSource,
    usedSeedTargets: Boolean(request.seed_targets?.length),
    requestedLimit: request.limit ?? limit,
    effectiveLimit: limit,
    minConfidence,
    providers: providerChain,
  });

  createScoutRun(database, {
    runId,
    targetCompany: request.target_company,
    targetFunction: request.target_function,
    targetTitle: request.target_title,
    source: initialSource,
    status: "running",
    notes: "Scout run started.",
  });

  try {
    const discovery = await discoverTargets(request, providerChain, limit, minConfidence, runId);
    diagnostics = discovery.diagnostics;

    if (discovery.targets.length === 0 && discovery.allQueriedProvidersErrored) {
      throw new Error(buildProviderFailureMessage(diagnostics.adapter_attempts));
    }

    if (discovery.targets.length === 0) {
      const hasConfiguredAdapter =
        diagnostics.used_seed_targets ||
        diagnostics.adapter_attempts.some((attempt) => attempt.status !== "not_configured");

      saveScoutDiagnostics(database, diagnostics);

      updateScoutRunStatus(
        database,
        runId,
        hasConfiguredAdapter ? "completed" : "needs_adapter",
        hasConfiguredAdapter
          ? "No matching second-degree targets found for the current query."
          : "No targets discovered. Provide seed_targets or configure at least one scout provider.",
        diagnostics.source
      );

      const run = getScoutRunById(database, runId);
      if (!run) {
        throw new Error("Scout run not found after creation");
      }

      return {
        run,
        diagnostics,
      };
    }

    const savedTargets = saveScoutTargets(database, runId, discovery.targets);
    const connectorPaths = buildConnectorPaths(
      database,
      request.target_company,
      request.target_function,
      savedTargets,
      scoutV2Weights
    );
    saveConnectorPaths(database, runId, connectorPaths);
    saveScoutDiagnostics(database, diagnostics);

    updateScoutRunStatus(
      database,
      runId,
      "completed",
      `Scouted ${savedTargets.length} potential targets and mapped ${connectorPaths.length} connector paths using ${diagnostics.source}.`,
      diagnostics.source
    );

    const run = getScoutRunById(database, runId);
    if (!run) {
      throw new Error("Scout run not found after completion");
    }

    return {
      run,
      diagnostics,
    };
  } catch (error) {
    updateScoutRunStatus(
      database,
      runId,
      "failed",
      error instanceof Error ? error.message : String(error),
      diagnostics.source
    );
    saveScoutDiagnostics(database, diagnostics);

    const run = getScoutRunById(database, runId);
    if (!run) {
      throw new Error("Scout run failed and could not be loaded");
    }

    return {
      run,
      diagnostics,
    };
  }
}

async function discoverTargets(
  request: SecondDegreeScoutRequest,
  providers: ScoutProvider[],
  limit: number,
  minConfidence: number,
  runId: string
): Promise<{
  targets: ScoutProviderTarget[];
  diagnostics: ScoutRunDiagnostics;
  allQueriedProvidersErrored: boolean;
}> {
  const effectiveLimit = Math.min(limit, MAX_TARGETS_PER_RUN);
  const requestedLimit = request.limit ?? limit;
  const attempts: ScoutAdapterAttempt[] = [];

  if (Array.isArray(request.seed_targets) && request.seed_targets.length > 0) {
    const discovered = request.seed_targets
      .slice(0, Math.min(effectiveLimit, MAX_SEED_TARGETS))
      .map((target) => mapSeedTarget(target));

    const normalizedTargets = normalizeAndFilterTargets(discovered, minConfidence, effectiveLimit);
    attempts.push({
      adapter: "seed_targets",
      status: normalizedTargets.length > 0 ? "success" : "no_results",
      result_count: normalizedTargets.length,
    });

    return {
      targets: normalizedTargets,
      diagnostics: {
        run_id: runId,
        source: "seed_targets",
        used_seed_targets: true,
        requested_limit: requestedLimit,
        effective_limit: effectiveLimit,
        min_confidence: minConfidence,
        adapter_attempts: attempts,
      },
      allQueriedProvidersErrored: false,
    };
  }

  const discovered: ScoutProviderTarget[] = [];
  const sourceContributors: string[] = [];
  let queriedProviders = 0;
  let providerErrors = 0;

  for (const provider of providers) {
    if (!provider.isConfigured()) {
      attempts.push({
        adapter: provider.name,
        status: "not_configured",
        result_count: 0,
      });
      continue;
    }

    const remaining = effectiveLimit - discovered.length;
    if (remaining <= 0) {
      break;
    }

    queriedProviders += 1;

    try {
      const providerTargets = await provider.searchCompanySecondDegree({
        targetCompany: request.target_company,
        targetFunction: request.target_function,
        targetTitle: request.target_title,
        limit: remaining,
      });

      attempts.push({
        adapter: provider.name,
        status: providerTargets.length > 0 ? "success" : "no_results",
        result_count: providerTargets.length,
      });

      if (providerTargets.length > 0) {
        sourceContributors.push(provider.name);
        discovered.push(...providerTargets);
      }
    } catch (error) {
      providerErrors += 1;
      attempts.push({
        adapter: provider.name,
        status: "error",
        result_count: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const normalizedTargets = normalizeAndFilterTargets(discovered, minConfidence, effectiveLimit);
  const source = normalizedTargets.length > 0
    ? sourceContributors.length > 0
      ? sourceContributors.join("+")
      : providers[0]?.name ?? "noop"
    : providers[0]?.name ?? "noop";

  return {
    targets: normalizedTargets,
    diagnostics: {
      run_id: runId,
      source,
      used_seed_targets: false,
      requested_limit: requestedLimit,
      effective_limit: effectiveLimit,
      min_confidence: minConfidence,
      adapter_attempts: attempts,
    },
    allQueriedProvidersErrored: queriedProviders > 0 && providerErrors === queriedProviders,
  };
}

function normalizeProviderChain(providers: ScoutProvider | ScoutProvider[]): ScoutProvider[] {
  const providerList = Array.isArray(providers) ? providers : [providers];
  const uniqueProviders: ScoutProvider[] = [];

  for (const provider of providerList) {
    if (uniqueProviders.some((candidate) => candidate.name === provider.name)) {
      continue;
    }
    uniqueProviders.push(provider);
  }

  if (uniqueProviders.length > 0) {
    return uniqueProviders;
  }

  return [new NoopScoutProvider()];
}

function createInitialDiagnostics(input: {
  runId: string;
  source: string;
  usedSeedTargets: boolean;
  requestedLimit: number;
  effectiveLimit: number;
  minConfidence: number;
  providers: ScoutProvider[];
}): ScoutRunDiagnostics {
  return {
    run_id: input.runId,
    source: input.source,
    used_seed_targets: input.usedSeedTargets,
    requested_limit: input.requestedLimit,
    effective_limit: input.effectiveLimit,
    min_confidence: input.minConfidence,
    adapter_attempts: input.providers.map((provider) => ({
      adapter: provider.name,
      status: provider.isConfigured() ? "no_results" : "not_configured",
      result_count: 0,
    })),
  };
}

function buildProviderFailureMessage(attempts: ScoutAdapterAttempt[]): string {
  const failedAdapters = attempts
    .filter((attempt) => attempt.status === "error")
    .map((attempt) => `${attempt.adapter}${attempt.error ? ` (${attempt.error})` : ""}`);

  if (failedAdapters.length === 0) {
    return "All configured scout providers failed.";
  }

  return `All configured scout providers failed: ${failedAdapters.join(", ")}`;
}

function mapSeedTarget(target: ScoutSeedTarget): ScoutProviderTarget {
  return {
    full_name: target.full_name,
    current_company: target.current_company,
    current_title: target.current_title,
    linkedin_url: target.linkedin_url,
    confidence: target.confidence,
    match_reason: "seed_target",
  };
}

function buildConnectorPaths(
  database: Database,
  targetCompany: string,
  targetFunction: string | undefined,
  targets: Array<{
    id: string;
    full_name: string;
    current_title?: string;
    current_company?: string;
    confidence: number;
  }>,
  weights: ScoutV2Weights
): Array<{
  target_id: string;
  connector_contact_id?: string;
  connector_name: string;
  connector_strength: number;
  path_score: number;
  rationale?: string;
  recommended_ask?: "context" | "intro" | "referral";
  score_breakdown?: ConnectorPathScoreBreakdown;
}> {
  const companyConnectors = findContactsByCompany(database, targetCompany);
  const fallbackConnectors = listContacts(database, 200);
  const pool = companyConnectors.length > 0 ? companyConnectors : fallbackConnectors;

  if (pool.length === 0) {
    return [];
  }

  const functionToken = (targetFunction ?? "").toLowerCase();
  const connectorPaths: Array<{
    target_id: string;
    connector_contact_id?: string;
    connector_name: string;
    connector_strength: number;
    path_score: number;
    rationale?: string;
    recommended_ask?: "context" | "intro" | "referral";
    score_breakdown?: ConnectorPathScoreBreakdown;
  }> = [];

  for (const target of targets) {
    const scored = pool
      .map((connector) => {
        const connectorStrength = estimateConnectorStrength(connector.connected_on);
        return scoreConnectorPath({
          connector,
          target,
          targetCompany,
          functionToken,
          connectorStrength,
          weights,
        });
      })
      .sort((a, b) => b.pathScore - a.pathScore)
      .slice(0, MAX_CONNECTORS_PER_TARGET);

    for (const candidate of scored) {
      connectorPaths.push({
        target_id: target.id,
        connector_contact_id: candidate.connector.id,
        connector_name: candidate.connector.name,
        connector_strength: candidate.connectorStrength,
        path_score: candidate.pathScore,
        rationale: candidate.rationale,
        recommended_ask: candidate.ask,
        score_breakdown: candidate.scoreBreakdown,
      });

      if (connectorPaths.length >= MAX_CONNECTOR_PATHS) {
        return connectorPaths;
      }
    }
  }

  return connectorPaths;
}

function estimateConnectorStrength(connectedOn: string | null): number {
  if (!connectedOn) return 0.55;
  const parsed = Date.parse(connectedOn);
  if (Number.isNaN(parsed)) return 0.55;

  const ageDays = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
  if (ageDays <= 365) return 0.85;
  if (ageDays <= 365 * 3) return 0.75;
  if (ageDays <= 365 * 7) return 0.65;
  return 0.5;
}

function scoreConnectorPath(input: {
  connector: {
    id: string;
    name: string;
    current_title: string | null;
    current_company: string | null;
  };
  target: {
    current_title?: string;
    current_company?: string;
    confidence: number;
  };
  targetCompany: string;
  functionToken: string;
  connectorStrength: number;
  weights: ScoutV2Weights;
}): {
  connector: {
    id: string;
    name: string;
    current_title: string | null;
    current_company: string | null;
  };
  connectorStrength: number;
  pathScore: number;
  ask: "context" | "intro" | "referral";
  rationale: string;
  scoreBreakdown: ConnectorPathScoreBreakdown;
} {
  const connectorTitle = (input.connector.current_title ?? "").toLowerCase();
  const targetTitle = (input.target.current_title ?? "").toLowerCase();
  const connectorCompany = (input.connector.current_company ?? "").toLowerCase();
  const targetCompanyNeedle = input.targetCompany.toLowerCase();
  const targetCurrentCompany = (input.target.current_company ?? "").toLowerCase();
  const companyMatch = connectorCompany.includes(targetCompanyNeedle);
  const sharedTargetCompany =
    targetCurrentCompany.length > 0 && connectorCompany.includes(targetCurrentCompany);
  const baseAsk = classifyAskType(input.connector.current_title ?? "");

  const targetTokens = targetTitle.split(/\s+/).filter((token) => token.length > 2);
  const titleOverlap = targetTokens.filter((token) => connectorTitle.includes(token)).length;
  const functionMatch = input.functionToken && connectorTitle.includes(input.functionToken) ? 1 : 0;
  const seniorityAlignment = estimateSeniorityAlignment(connectorTitle, targetTitle);
  const connectorInfluence = estimateConnectorInfluence(connectorTitle);

  const companyAlignmentSignal = companyMatch ? 1 : sharedTargetCompany ? 0.72 : 0.35;
  const roleAlignmentSignal = clamp01(titleOverlap * 0.24 + functionMatch * 0.34 + seniorityAlignment * 0.42);
  const relationshipSignal = clamp01(input.connectorStrength);
  const targetConfidenceSignal = clamp01(input.target.confidence);
  const hasCompanyContext = companyMatch || sharedTargetCompany;
  const askFitSignal = estimateAskFitSignal({
    ask: baseAsk,
    connectorInfluence,
    relationshipSignal,
    targetConfidenceSignal,
    hasCompanyContext,
  });
  const safetySignal = estimateSafetySignal({
    connectorStrength: relationshipSignal,
    targetConfidence: targetConfidenceSignal,
    hasCompanyContext,
    connectorInfluence,
  });

  const totalBeforeGuardrails =
    scoreByWeight(companyAlignmentSignal, input.weights.company_alignment) +
    scoreByWeight(roleAlignmentSignal, input.weights.role_alignment) +
    scoreByWeight(relationshipSignal, input.weights.relationship) +
    scoreByWeight(connectorInfluence, input.weights.connector_influence) +
    scoreByWeight(targetConfidenceSignal, input.weights.target_confidence) +
    scoreByWeight(askFitSignal, input.weights.ask_fit) +
    scoreByWeight(safetySignal, input.weights.safety);

  const guardrailResult = applyAskGuardrails({
    ask: baseAsk,
    connectorStrength: relationshipSignal,
    targetConfidence: targetConfidenceSignal,
    safetySignal,
    hasCompanyContext,
  });

  const guardrailPenalty = guardrailResult.adjustments.length * 4;
  const pathScore = Math.max(0, Math.min(100, Math.round((totalBeforeGuardrails - guardrailPenalty) * 100) / 100));
  const qualityTier = classifyQualityTier(pathScore, safetySignal);

  const rationaleParts: string[] = [];
  if (companyMatch) rationaleParts.push("direct company match");
  else if (sharedTargetCompany) rationaleParts.push("shared target-company context");
  if (roleAlignmentSignal >= 0.62) rationaleParts.push("strong function/title alignment");
  if (seniorityAlignment >= 0.7) rationaleParts.push("good seniority alignment");
  if (connectorInfluence >= 0.65) rationaleParts.push("high-influence connector role");
  if (relationshipSignal >= 0.72) rationaleParts.push("high connector strength");
  if (targetConfidenceSignal >= 0.7) rationaleParts.push("high target confidence");
  if (safetySignal < 0.6) rationaleParts.push("safety constraints applied");

  const rationalePrefix = rationaleParts.length > 0
    ? `Path ranks well due to ${rationaleParts.join(", ")}.`
    : "Path is viable but lower-confidence than other options.";

  const rationale = guardrailResult.adjustments.length > 0
    ? `${rationalePrefix} Ask guardrails: ${guardrailResult.adjustments.join(", ")}.`
    : rationalePrefix;

  const scoreBreakdown: ConnectorPathScoreBreakdown = {
    scoring_version: "v2",
    company_alignment: scoreByWeight(companyAlignmentSignal, input.weights.company_alignment),
    role_alignment: scoreByWeight(roleAlignmentSignal, input.weights.role_alignment),
    relationship: scoreByWeight(relationshipSignal, input.weights.relationship),
    connector_influence: scoreByWeight(connectorInfluence, input.weights.connector_influence),
    target_confidence: scoreByWeight(targetConfidenceSignal, input.weights.target_confidence),
    ask_fit: scoreByWeight(askFitSignal, input.weights.ask_fit),
    safety: scoreByWeight(safetySignal, input.weights.safety),
    total_before_guardrails: Math.round(totalBeforeGuardrails * 100) / 100,
    guardrail_penalty: guardrailPenalty,
    quality_tier: qualityTier,
    guardrail_adjustments: guardrailResult.adjustments,
  };

  return {
    connector: input.connector,
    connectorStrength: input.connectorStrength,
    pathScore,
    ask: guardrailResult.ask,
    rationale,
    scoreBreakdown,
  };
}

function scoreByWeight(signal: number, weight: number): number {
  return Math.round(clamp01(signal) * weight * 100) / 100;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function classifyQualityTier(pathScore: number, safetySignal: number): "high" | "medium" | "low" {
  if (pathScore >= 80 && safetySignal >= 0.65) {
    return "high";
  }

  if (pathScore >= 65 && safetySignal >= 0.45) {
    return "medium";
  }

  return "low";
}

function estimateAskFitSignal(input: {
  ask: "context" | "intro" | "referral";
  connectorInfluence: number;
  relationshipSignal: number;
  targetConfidenceSignal: number;
  hasCompanyContext: boolean;
}): number {
  const confidenceBlend =
    input.connectorInfluence * 0.4 +
    input.relationshipSignal * 0.35 +
    input.targetConfidenceSignal * 0.25;

  if (input.ask === "referral") {
    return clamp01(confidenceBlend + (input.hasCompanyContext ? 0.1 : -0.05));
  }

  if (input.ask === "intro") {
    return clamp01(0.65 + confidenceBlend * 0.25 + (input.hasCompanyContext ? 0.05 : 0));
  }

  return clamp01(0.6 + input.relationshipSignal * 0.2 + (input.hasCompanyContext ? 0.08 : 0));
}

function estimateSafetySignal(input: {
  connectorStrength: number;
  targetConfidence: number;
  hasCompanyContext: boolean;
  connectorInfluence: number;
}): number {
  let safety = 0.35;
  safety += input.hasCompanyContext ? 0.2 : 0;
  safety += input.connectorStrength * 0.25;
  safety += input.targetConfidence * 0.15;
  safety += input.connectorInfluence * 0.05;

  if (!input.hasCompanyContext) {
    safety -= 0.1;
  }

  return clamp01(safety);
}

function applyAskGuardrails(input: {
  ask: "context" | "intro" | "referral";
  connectorStrength: number;
  targetConfidence: number;
  safetySignal: number;
  hasCompanyContext: boolean;
}): {
  ask: "context" | "intro" | "referral";
  adjustments: string[];
} {
  const adjustments: string[] = [];
  let ask = input.ask;

  if (ask === "referral" && (!input.hasCompanyContext || input.safetySignal < 0.62)) {
    ask = "intro";
    adjustments.push("downgraded referral to intro due to weak company context/safety");
  }

  if (ask === "referral" && (input.connectorStrength < 0.7 || input.targetConfidence < 0.65)) {
    ask = "intro";
    adjustments.push("downgraded referral to intro due to low connector strength/target confidence");
  }

  if (ask === "intro" && (input.connectorStrength < 0.45 || input.targetConfidence < 0.5)) {
    ask = "context";
    adjustments.push("downgraded intro to context due to low confidence");
  }

  return {
    ask,
    adjustments,
  };
}

function estimateSeniorityAlignment(connectorTitle: string, targetTitle: string): number {
  const connectorLevel = inferSeniorityLevel(connectorTitle);
  const targetLevel = inferSeniorityLevel(targetTitle);

  if (connectorLevel === "unknown" || targetLevel === "unknown") {
    return 0.4;
  }

  if (connectorLevel === targetLevel) {
    return 1;
  }

  const distance = Math.abs(connectorLevel - targetLevel);
  if (distance === 1) {
    return 0.7;
  }

  return 0.25;
}

function estimateConnectorInfluence(title: string): number {
  let influence = 0.3;

  if (/(chief|vp|vice president|head|director|founder|partner)/i.test(title)) {
    influence += 0.35;
  }

  if (/(recruiter|talent|hiring|people|staffing)/i.test(title)) {
    influence += 0.35;
  }

  if (/(manager|lead)/i.test(title)) {
    influence += 0.15;
  }

  return Math.max(0, Math.min(1, Number(influence.toFixed(2))));
}

function inferSeniorityLevel(title: string): number | "unknown" {
  if (!title.trim()) {
    return "unknown";
  }

  if (/(chief|vp|vice president|head|director|founder|partner)/i.test(title)) {
    return 4;
  }

  if (/(manager|lead)/i.test(title)) {
    return 3;
  }

  if (/(senior|staff|principal)/i.test(title)) {
    return 2;
  }

  if (/(associate|assistant|coordinator|intern|junior)/i.test(title)) {
    return 0;
  }

  return 1;
}

function loadScoutV2WeightsFromEnv(): ScoutV2Weights {
  const raw: ScoutV2Weights = {
    company_alignment: parseWeight(process.env.SCOUT_V2_WEIGHT_COMPANY_ALIGNMENT, DEFAULT_SCOUT_V2_WEIGHTS.company_alignment),
    role_alignment: parseWeight(process.env.SCOUT_V2_WEIGHT_ROLE_ALIGNMENT, DEFAULT_SCOUT_V2_WEIGHTS.role_alignment),
    relationship: parseWeight(process.env.SCOUT_V2_WEIGHT_RELATIONSHIP, DEFAULT_SCOUT_V2_WEIGHTS.relationship),
    connector_influence: parseWeight(process.env.SCOUT_V2_WEIGHT_CONNECTOR_INFLUENCE, DEFAULT_SCOUT_V2_WEIGHTS.connector_influence),
    target_confidence: parseWeight(process.env.SCOUT_V2_WEIGHT_TARGET_CONFIDENCE, DEFAULT_SCOUT_V2_WEIGHTS.target_confidence),
    ask_fit: parseWeight(process.env.SCOUT_V2_WEIGHT_ASK_FIT, DEFAULT_SCOUT_V2_WEIGHTS.ask_fit),
    safety: parseWeight(process.env.SCOUT_V2_WEIGHT_SAFETY, DEFAULT_SCOUT_V2_WEIGHTS.safety),
  };

  return normalizeScoutV2Weights(raw);
}

function resolveScoutV2Weights(overrides?: Partial<ScoutV2Weights>): ScoutV2Weights {
  if (!overrides) {
    return loadScoutV2WeightsFromEnv();
  }

  const base = loadScoutV2WeightsFromEnv();
  return normalizeScoutV2Weights({
    company_alignment: clampWeightNumber(overrides.company_alignment, base.company_alignment),
    role_alignment: clampWeightNumber(overrides.role_alignment, base.role_alignment),
    relationship: clampWeightNumber(overrides.relationship, base.relationship),
    connector_influence: clampWeightNumber(overrides.connector_influence, base.connector_influence),
    target_confidence: clampWeightNumber(overrides.target_confidence, base.target_confidence),
    ask_fit: clampWeightNumber(overrides.ask_fit, base.ask_fit),
    safety: clampWeightNumber(overrides.safety, base.safety),
  });
}

function normalizeScoutV2Weights(raw: ScoutV2Weights): ScoutV2Weights {
  const total =
    raw.company_alignment +
    raw.role_alignment +
    raw.relationship +
    raw.connector_influence +
    raw.target_confidence +
    raw.ask_fit +
    raw.safety;

  if (total <= 0) {
    return { ...DEFAULT_SCOUT_V2_WEIGHTS };
  }

  const normalize = (value: number): number => Math.round((value / total) * 10000) / 100;
  return {
    company_alignment: normalize(raw.company_alignment),
    role_alignment: normalize(raw.role_alignment),
    relationship: normalize(raw.relationship),
    connector_influence: normalize(raw.connector_influence),
    target_confidence: normalize(raw.target_confidence),
    ask_fit: normalize(raw.ask_fit),
    safety: normalize(raw.safety),
  };
}

function parseWeight(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, parsed));
}

function clampWeightNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, value));
}

function clampLimit(limit: number): number {
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

function normalizeAndFilterTargets(
  targets: ScoutProviderTarget[],
  minConfidence: number,
  maxResults: number
): ScoutProviderTarget[] {
  const deduped = new Map<string, ScoutProviderTarget>();

  for (const target of targets) {
    const fullName = normalizeName(target.full_name);
    if (!fullName) {
      continue;
    }

    const confidence = clampConfidence(target.confidence);
    if (confidence < minConfidence) {
      continue;
    }

    const key = (target.linkedin_url?.toLowerCase().trim() || fullName.toLowerCase()).replace(/\/$/, "");
    const normalized: ScoutProviderTarget = {
      ...target,
      full_name: fullName,
      confidence,
      current_company: target.current_company?.trim() || undefined,
      current_title: target.current_title?.trim() || undefined,
      headline: target.headline?.trim() || undefined,
      linkedin_url: target.linkedin_url?.trim() || undefined,
    };

    const existing = deduped.get(key);
    if (!existing || (existing.confidence ?? 0) < confidence) {
      deduped.set(key, normalized);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, maxResults);
}

function normalizeName(name: string | undefined): string {
  if (!name) return "";
  return name.replace(/\s+/g, " ").trim();
}

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.6;
  }
  return Math.max(0, Math.min(1, value));
}

function parseMinConfidence(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_MIN_TARGET_CONFIDENCE;
  }
  return parseMinConfidenceValue(parsed);
}

function parseMinConfidenceValue(value: number): number {
  return Math.max(0, Math.min(1, value));
}
