import type { ScoutProvider, ScoutProviderTarget } from "./second-degree-scout";

interface StaticScoutProviderOptions {
  targets?: ScoutProviderTarget[];
  name?: string;
}

export class StaticScoutProvider implements ScoutProvider {
  readonly name: string;
  private readonly targets: ScoutProviderTarget[];

  constructor(options: StaticScoutProviderOptions = {}) {
    this.name = options.name?.trim() || "static_seed";
    this.targets = normalizeTargets(options.targets ?? []);
  }

  isConfigured(): boolean {
    return this.targets.length > 0;
  }

  async searchCompanySecondDegree(input: {
    targetCompany: string;
    targetFunction?: string;
    targetTitle?: string;
    limit: number;
  }): Promise<ScoutProviderTarget[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const companyNeedle = input.targetCompany.toLowerCase();
    const functionNeedle = input.targetFunction?.toLowerCase();
    const titleNeedle = input.targetTitle?.toLowerCase();

    const ranked = this.targets
      .map((target) => {
        const title = `${target.current_title ?? ""} ${target.headline ?? ""}`.toLowerCase();
        const company = (target.current_company ?? "").toLowerCase();

        let score = 0;
        if (company.includes(companyNeedle)) {
          score += 3;
        }
        if (functionNeedle && title.includes(functionNeedle)) {
          score += 2;
        }
        if (titleNeedle) {
          const titleTokens = titleNeedle.split(/\s+/).filter((token) => token.length > 2);
          const tokenMatches = titleTokens.filter((token) => title.includes(token)).length;
          score += Math.min(2, tokenMatches);
        }

        return {
          target,
          score,
        };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return (b.target.confidence ?? 0.6) - (a.target.confidence ?? 0.6);
      })
      .slice(0, input.limit)
      .map((item) => ({
        ...item.target,
        match_reason: item.target.match_reason ?? "static_seed_match",
      }));

    return ranked;
  }
}

export function createStaticScoutProviderFromEnv(): StaticScoutProvider {
  const targets = parseTargetsFromEnv(process.env.SCOUT_STATIC_TARGETS_JSON);
  return new StaticScoutProvider({
    targets,
    name: "static_seed",
  });
}

function parseTargetsFromEnv(value: string | undefined): ScoutProviderTarget[] {
  if (!value || value.trim().length === 0) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeTargets(parsed as ScoutProviderTarget[]);
  } catch {
    return [];
  }
}

function normalizeTargets(targets: ScoutProviderTarget[]): ScoutProviderTarget[] {
  return targets
    .map((target) => ({
      full_name: target.full_name?.trim() ?? "",
      headline: target.headline?.trim() || undefined,
      current_company: target.current_company?.trim() || undefined,
      current_title: target.current_title?.trim() || undefined,
      linkedin_url: target.linkedin_url?.trim() || undefined,
      confidence: clampConfidence(target.confidence),
      match_reason: target.match_reason?.trim() || undefined,
    }))
    .filter((target) => target.full_name.length > 1);
}

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.65;
  }
  return Math.max(0, Math.min(1, value));
}
