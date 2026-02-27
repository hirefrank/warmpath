import { LinkedInScoutProvider } from "./linkedin-scout-provider";
import {
  StaticScoutProvider,
  parseStaticScoutTargets,
} from "./static-scout-provider";
import type { ScoutProvider } from "./second-degree-scout";

const DEFAULT_PROVIDER_ORDER = ["linkedin_li_at", "static_seed"];

export interface ScoutProviderChainConfig {
  providerOrder?: string;
  linkedInLiAt?: string;
  linkedInRequestTimeoutMs?: number;
  linkedInRateLimitMs?: number;
  staticTargetsJson?: string;
}

export function createScoutProviderChain(config: ScoutProviderChainConfig = {}): ScoutProvider[] {
  const providersByName: Record<string, ScoutProvider> = {
    linkedin_li_at: new LinkedInScoutProvider({
      liAtCookie: config.linkedInLiAt,
      requestTimeoutMs: config.linkedInRequestTimeoutMs,
      minDelayMs: config.linkedInRateLimitMs,
    }),
    static_seed: new StaticScoutProvider({
      targets: parseStaticScoutTargets(config.staticTargetsJson),
      name: "static_seed",
    }),
  };

  const order = parseProviderOrder(config.providerOrder);
  const selectedNames = order.length > 0 ? order : DEFAULT_PROVIDER_ORDER;
  const selectedProviders: ScoutProvider[] = [];

  for (const name of selectedNames) {
    const provider = providersByName[name];
    if (!provider) {
      continue;
    }

    if (selectedProviders.some((candidate) => candidate.name === provider.name)) {
      continue;
    }

    selectedProviders.push(provider);
  }

  if (selectedProviders.length > 0) {
    return selectedProviders;
  }

  return [providersByName.linkedin_li_at];
}

export function createScoutProviderChainFromEnv(): ScoutProvider[] {
  return createScoutProviderChain({
    providerOrder: process.env.SCOUT_PROVIDER_ORDER,
    linkedInLiAt: process.env.LINKEDIN_LI_AT ?? process.env.LINKEDIN_LI_AT_COOKIE ?? process.env.LI_AT,
    linkedInRequestTimeoutMs: parseOptionalNumber(process.env.LINKEDIN_REQUEST_TIMEOUT_MS),
    linkedInRateLimitMs: parseOptionalNumber(process.env.LINKEDIN_RATE_LIMIT_MS),
    staticTargetsJson: process.env.SCOUT_STATIC_TARGETS_JSON,
  });
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseProviderOrder(value: string | undefined): string[] {
  if (!value || value.trim().length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}
