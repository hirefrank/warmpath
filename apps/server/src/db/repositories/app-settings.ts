import type { Database } from "bun:sqlite";
import type {
  WarmPathSettings,
  WarmPathSettingsResponse,
} from "../../../../../packages/shared/src/contracts/warm-path";

interface SettingRow {
  key: string;
  value: string;
}

const DEFAULTS = {
  advisor_slug: "hirefrank",
  default_job_category: "product",
  linkedin_rate_limit_ms: 1200,
  linkedin_request_timeout_ms: 15000,
  scout_min_target_confidence: 0.45,
  scout_provider_order: "linkedin_li_at,static_seed",
} as const;

export interface ScoutRuntimeSettings {
  linkedInLiAt: string;
  linkedInRateLimitMs: number;
  linkedInRequestTimeoutMs: number;
  scoutMinTargetConfidence: number;
  scoutProviderOrder: string;
  scoutStaticTargetsJson: string;
}

export function getWarmPathSettings(database: Database): WarmPathSettingsResponse {
  const raw = getRawSettings(database);

  const settings: WarmPathSettings = {
    advisor_slug: normalizeString(raw.advisor_slug, DEFAULTS.advisor_slug),
    default_job_category: normalizeString(raw.default_job_category, DEFAULTS.default_job_category),
    linkedin_li_at: resolveLinkedInCookie(raw.linkedin_li_at),
    linkedin_rate_limit_ms: parseNumber(
      raw.linkedin_rate_limit_ms,
      Number(process.env.LINKEDIN_RATE_LIMIT_MS),
      DEFAULTS.linkedin_rate_limit_ms,
      100,
      120000
    ),
    linkedin_request_timeout_ms: parseNumber(
      raw.linkedin_request_timeout_ms,
      Number(process.env.LINKEDIN_REQUEST_TIMEOUT_MS),
      DEFAULTS.linkedin_request_timeout_ms,
      1000,
      120000
    ),
    scout_min_target_confidence: parseNumber(
      raw.scout_min_target_confidence,
      Number(process.env.SCOUT_MIN_TARGET_CONFIDENCE),
      DEFAULTS.scout_min_target_confidence,
      0,
      1
    ),
    scout_provider_order: normalizeString(raw.scout_provider_order, process.env.SCOUT_PROVIDER_ORDER ?? DEFAULTS.scout_provider_order),
    scout_static_targets_json: raw.scout_static_targets_json ?? process.env.SCOUT_STATIC_TARGETS_JSON ?? "",
  };

  return {
    settings,
    hints: {
      linkedin_configured: settings.linkedin_li_at.trim().length > 0,
      static_seed_configured: hasStaticTargets(settings.scout_static_targets_json),
    },
  };
}

export function updateWarmPathSettings(
  database: Database,
  patch: Partial<WarmPathSettings>
): WarmPathSettingsResponse {
  const pairs: Array<{ key: string; value: string | null }> = [];

  if (patch.advisor_slug !== undefined) {
    pairs.push({ key: "advisor_slug", value: normalizeStoredString(patch.advisor_slug) });
  }
  if (patch.default_job_category !== undefined) {
    pairs.push({ key: "default_job_category", value: normalizeStoredString(patch.default_job_category) });
  }
  if (patch.linkedin_li_at !== undefined) {
    pairs.push({ key: "linkedin_li_at", value: normalizeStoredString(patch.linkedin_li_at) });
  }
  if (patch.linkedin_rate_limit_ms !== undefined) {
    pairs.push({ key: "linkedin_rate_limit_ms", value: Number(patch.linkedin_rate_limit_ms).toString() });
  }
  if (patch.linkedin_request_timeout_ms !== undefined) {
    pairs.push({ key: "linkedin_request_timeout_ms", value: Number(patch.linkedin_request_timeout_ms).toString() });
  }
  if (patch.scout_min_target_confidence !== undefined) {
    pairs.push({ key: "scout_min_target_confidence", value: Number(patch.scout_min_target_confidence).toString() });
  }
  if (patch.scout_provider_order !== undefined) {
    pairs.push({ key: "scout_provider_order", value: normalizeStoredString(patch.scout_provider_order) });
  }
  if (patch.scout_static_targets_json !== undefined) {
    const value = patch.scout_static_targets_json.trim();
    pairs.push({ key: "scout_static_targets_json", value: value.length > 0 ? value : null });
  }

  if (pairs.length === 0) {
    return getWarmPathSettings(database);
  }

  const save = database.transaction(() => {
    for (const pair of pairs) {
      if (pair.value === null) {
        database.query("DELETE FROM app_settings WHERE key = ?").run(pair.key);
        continue;
      }

      database
        .query(
          `
          INSERT INTO app_settings (key, value, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
          `
        )
        .run(pair.key, pair.value, new Date().toISOString());
    }
  });

  save();
  return getWarmPathSettings(database);
}

export function getScoutRuntimeSettings(database: Database): ScoutRuntimeSettings {
  const settings = getWarmPathSettings(database).settings;

  return {
    linkedInLiAt: settings.linkedin_li_at,
    linkedInRateLimitMs: settings.linkedin_rate_limit_ms,
    linkedInRequestTimeoutMs: settings.linkedin_request_timeout_ms,
    scoutMinTargetConfidence: settings.scout_min_target_confidence,
    scoutProviderOrder: settings.scout_provider_order,
    scoutStaticTargetsJson: settings.scout_static_targets_json,
  };
}

function getRawSettings(database: Database): Record<string, string> {
  const rows = database.query("SELECT key, value FROM app_settings").all() as SettingRow[];
  const output: Record<string, string> = {};

  for (const row of rows) {
    output[row.key] = row.value;
  }

  return output;
}

function normalizeString(value: string | undefined, fallback: string): string {
  const next = value?.trim() ?? "";
  return next.length > 0 ? next : fallback;
}

function normalizeStoredString(value: string): string | null {
  const next = value.trim();
  return next.length > 0 ? next : null;
}

function parseNumber(
  raw: string | undefined,
  envFallback: number,
  defaultValue: number,
  min: number,
  max: number
): number {
  const value = Number(raw ?? envFallback);
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  return Math.max(min, Math.min(max, value));
}

function resolveLinkedInCookie(stored: string | undefined): string {
  const value = stored?.trim();
  if (value && value.length > 0) {
    return value;
  }

  return (
    process.env.LINKEDIN_LI_AT ??
    process.env.LINKEDIN_LI_AT_COOKIE ??
    process.env.LI_AT ??
    ""
  );
}

function hasStaticTargets(raw: string): boolean {
  const value = raw.trim();
  if (!value) {
    return false;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}
