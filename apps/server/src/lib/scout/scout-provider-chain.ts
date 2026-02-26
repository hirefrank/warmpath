import { createLinkedInScoutProviderFromEnv } from "./linkedin-scout-provider";
import { createStaticScoutProviderFromEnv } from "./static-scout-provider";
import type { ScoutProvider } from "./second-degree-scout";

const DEFAULT_PROVIDER_ORDER = ["linkedin_li_at", "static_seed"];

export function createScoutProviderChainFromEnv(): ScoutProvider[] {
  const providersByName: Record<string, ScoutProvider> = {
    linkedin_li_at: createLinkedInScoutProviderFromEnv(),
    static_seed: createStaticScoutProviderFromEnv(),
  };

  const order = parseProviderOrder(process.env.SCOUT_PROVIDER_ORDER);
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

function parseProviderOrder(value: string | undefined): string[] {
  if (!value || value.trim().length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}
