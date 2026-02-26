import type { Database } from "bun:sqlite";
import {
  createScoutRun,
  getScoutRunById,
  saveConnectorPaths,
  saveScoutTargets,
  updateScoutRunStatus,
} from "../../db/repositories/second-degree-scout";
import { findContactsByCompany, listContacts } from "../../db/repositories/contacts";
import { classifyAskType } from "../scoring/ask-type";
import type {
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

export async function runSecondDegreeScout(
  database: Database,
  request: SecondDegreeScoutRequest,
  providers: ScoutProvider | ScoutProvider[] = [new NoopScoutProvider()]
): Promise<RunSecondDegreeScoutResult> {
  const runId = crypto.randomUUID();
  const limit = clampLimit(request.limit ?? 25);
  const minConfidence = parseMinConfidence(process.env.SCOUT_MIN_TARGET_CONFIDENCE);
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
      savedTargets
    );
    saveConnectorPaths(database, runId, connectorPaths);

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
  }>
): Array<{
  target_id: string;
  connector_contact_id?: string;
  connector_name: string;
  connector_strength: number;
  path_score: number;
  rationale?: string;
  recommended_ask?: "context" | "intro" | "referral";
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
} {
  const connectorTitle = (input.connector.current_title ?? "").toLowerCase();
  const targetTitle = (input.target.current_title ?? "").toLowerCase();
  const connectorCompany = (input.connector.current_company ?? "").toLowerCase();
  const companyMatch = connectorCompany.includes(input.targetCompany.toLowerCase());
  const ask = classifyAskType(input.connector.current_title ?? "");

  const targetTokens = targetTitle.split(/\s+/).filter((token) => token.length > 2);
  const titleOverlap = targetTokens.filter((token) => connectorTitle.includes(token)).length;
  const functionMatch = input.functionToken && connectorTitle.includes(input.functionToken) ? 1 : 0;

  const companyScore = companyMatch ? 32 : 10;
  const functionScore = Math.min(22, titleOverlap * 6 + functionMatch * 10);
  const relationshipScore = Math.round(input.connectorStrength * 28);
  const targetConfidenceScore = Math.round(input.target.confidence * 18);
  const askBonus = ask === "referral" ? 6 : ask === "context" ? 4 : 2;

  const rawScore = companyScore + functionScore + relationshipScore + targetConfidenceScore + askBonus;
  const pathScore = Math.max(0, Math.min(100, rawScore));

  const rationaleParts: string[] = [];
  if (companyMatch) rationaleParts.push("direct company match");
  if (functionScore >= 14) rationaleParts.push("strong function/title alignment");
  if (relationshipScore >= 20) rationaleParts.push("high connector strength");
  if (targetConfidenceScore >= 12) rationaleParts.push("high target confidence");

  const rationale = rationaleParts.length > 0
    ? `Path ranks well due to ${rationaleParts.join(", ")}.`
    : "Path is viable but lower-confidence than other options.";

  return {
    connector: input.connector,
    connectorStrength: input.connectorStrength,
    pathScore,
    ask,
    rationale,
  };
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
  return Math.max(0, Math.min(1, parsed));
}
