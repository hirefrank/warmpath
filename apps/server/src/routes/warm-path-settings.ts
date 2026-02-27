import { Hono } from "hono";
import {
  getScoutRuntimeSettings,
  getWarmPathSettings,
  updateWarmPathSettings,
} from "../db/repositories/app-settings";
import { getDatabase } from "../db";
import type {
  WarmPathSettings,
  WarmPathSettingsResponse,
  WarmPathSettingsUpdateRequest,
} from "../../../../packages/shared/src/contracts/warm-path";

const app = new Hono();

app.get("/api/warm-path/settings", (c) => {
  const response: WarmPathSettingsResponse = getWarmPathSettings(getDatabase());
  return c.json(response);
});

app.put("/api/warm-path/settings", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Partial<WarmPathSettingsUpdateRequest>;
    const candidate = body.settings;

    if (!candidate || typeof candidate !== "object") {
      return c.json({ error: "settings object is required" }, 400);
    }

    const parsed = validateSettingsPatch(candidate);
    if ("error" in parsed) {
      return c.json({ error: parsed.error }, 400);
    }

    const response = updateWarmPathSettings(getDatabase(), parsed.patch);
    return c.json(response);
  } catch (error) {
    return c.json(
      {
        error: "Failed to update settings",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.get("/api/warm-path/settings/scout-runtime", (c) => {
  const settings = getScoutRuntimeSettings(getDatabase());
  return c.json({ settings });
});

export default app;

function validateSettingsPatch(input: Partial<WarmPathSettings>):
  | { patch: Partial<WarmPathSettings> }
  | { error: string } {
  const patch: Partial<WarmPathSettings> = {};

  if (input.advisor_slug !== undefined) {
    if (typeof input.advisor_slug !== "string") {
      return { error: "advisor_slug must be a string" };
    }
    const value = input.advisor_slug.trim();
    if (value.length < 2 || value.length > 80) {
      return { error: "advisor_slug must be between 2 and 80 characters" };
    }
    patch.advisor_slug = value;
  }

  if (input.default_job_category !== undefined) {
    if (typeof input.default_job_category !== "string") {
      return { error: "default_job_category must be a string" };
    }
    const value = input.default_job_category.trim();
    if (value.length < 2 || value.length > 80) {
      return { error: "default_job_category must be between 2 and 80 characters" };
    }
    patch.default_job_category = value;
  }

  if (input.linkedin_li_at !== undefined) {
    if (typeof input.linkedin_li_at !== "string") {
      return { error: "linkedin_li_at must be a string" };
    }
    patch.linkedin_li_at = input.linkedin_li_at.trim();
  }

  if (input.linkedin_rate_limit_ms !== undefined) {
    if (!isFiniteNumber(input.linkedin_rate_limit_ms)) {
      return { error: "linkedin_rate_limit_ms must be a number" };
    }
    if (input.linkedin_rate_limit_ms < 100 || input.linkedin_rate_limit_ms > 120000) {
      return { error: "linkedin_rate_limit_ms must be between 100 and 120000" };
    }
    patch.linkedin_rate_limit_ms = input.linkedin_rate_limit_ms;
  }

  if (input.linkedin_request_timeout_ms !== undefined) {
    if (!isFiniteNumber(input.linkedin_request_timeout_ms)) {
      return { error: "linkedin_request_timeout_ms must be a number" };
    }
    if (input.linkedin_request_timeout_ms < 1000 || input.linkedin_request_timeout_ms > 120000) {
      return { error: "linkedin_request_timeout_ms must be between 1000 and 120000" };
    }
    patch.linkedin_request_timeout_ms = input.linkedin_request_timeout_ms;
  }

  if (input.scout_min_target_confidence !== undefined) {
    if (!isFiniteNumber(input.scout_min_target_confidence)) {
      return { error: "scout_min_target_confidence must be a number" };
    }
    if (input.scout_min_target_confidence < 0 || input.scout_min_target_confidence > 1) {
      return { error: "scout_min_target_confidence must be between 0 and 1" };
    }
    patch.scout_min_target_confidence = input.scout_min_target_confidence;
  }

  if (input.scout_provider_order !== undefined) {
    if (typeof input.scout_provider_order !== "string") {
      return { error: "scout_provider_order must be a string" };
    }

    const value = input.scout_provider_order
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .join(",");

    if (value.length === 0) {
      return { error: "scout_provider_order must include at least one provider" };
    }

    const allowed = new Set(["linkedin_li_at", "static_seed"]);
    const invalid = value.split(",").find((item) => !allowed.has(item));
    if (invalid) {
      return { error: `Unsupported scout provider: ${invalid}` };
    }

    patch.scout_provider_order = value;
  }

  if (input.scout_static_targets_json !== undefined) {
    if (typeof input.scout_static_targets_json !== "string") {
      return { error: "scout_static_targets_json must be a string" };
    }

    const value = input.scout_static_targets_json.trim();
    if (value.length > 0) {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (!Array.isArray(parsed)) {
          return { error: "scout_static_targets_json must be a JSON array" };
        }
      } catch {
        return { error: "scout_static_targets_json must be valid JSON" };
      }
    }

    patch.scout_static_targets_json = value;
  }

  return { patch };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
