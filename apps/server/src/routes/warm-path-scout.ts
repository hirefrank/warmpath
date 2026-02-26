import { Hono } from "hono";
import { getDatabase } from "../db";
import {
  getScoutRunStats,
  getScoutRunById,
  listScoutRuns,
} from "../db/repositories/second-degree-scout";
import { createScoutProviderChainFromEnv } from "../lib/scout/scout-provider-chain";
import { runSecondDegreeScout } from "../lib/scout/second-degree-scout";
import type { SecondDegreeScoutRequest } from "../../../../packages/shared/src/contracts/scout";
import { saveEvent } from "../db/repositories/warm-path-runs";
import type { WarmPathEvent } from "../../../../packages/shared/src/contracts/warm-path";

const app = new Hono();

app.post("/api/warm-path/scout/run", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Partial<SecondDegreeScoutRequest>;

    const validationError = validateScoutRequest(body);
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }

    const result = await runSecondDegreeScout(
      getDatabase(),
      {
        target_company: body.target_company!.trim(),
        target_function: body.target_function?.trim() || undefined,
        target_title: body.target_title?.trim() || undefined,
        limit: body.limit,
        seed_targets: body.seed_targets,
      },
      createScoutProviderChainFromEnv()
    );

    trackScoutEvent(result.run.id, result.run.status);

    return c.json({
      run: result.run,
      notes: result.run.notes,
      diagnostics: result.diagnostics,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to run second-degree scout",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.get("/api/warm-path/scout/runs", (c) => {
  const limit = Number(c.req.query("limit") ?? "20");
  const runs = listScoutRuns(getDatabase(), limit).map((run) => ({
    id: run.id,
    target_company: run.target_company,
    target_function: run.target_function,
    target_title: run.target_title,
    status: run.status,
    source: run.source,
    notes: run.notes,
    created_at: run.created_at,
    updated_at: run.updated_at,
  }));

  return c.json({ runs, total: runs.length });
});

app.get("/api/warm-path/scout/runs/:id", (c) => {
  const run = getScoutRunById(getDatabase(), c.req.param("id"));
  if (!run) {
    return c.json({ error: "Scout run not found" }, 404);
  }

  return c.json({ run });
});

app.get("/api/warm-path/scout/stats", (c) => {
  const stats = getScoutRunStats(getDatabase());
  return c.json({ stats });
});

export default app;

function trackScoutEvent(runId: string, status: string): void {
  const eventName = statusToEventName(status);
  if (!eventName) {
    return;
  }

  const event: WarmPathEvent = {
    name: eventName,
    run_id: runId,
    advisor_slug: "scout",
    occurred_at: new Date().toISOString(),
  };

  saveEvent(getDatabase(), event);
}

function statusToEventName(status: string): WarmPathEvent["name"] | null {
  if (status === "completed") return "scout_run_completed";
  if (status === "failed") return "scout_run_failed";
  if (status === "needs_adapter") return "scout_needs_adapter";
  return null;
}

function validateScoutRequest(body: Partial<SecondDegreeScoutRequest>): string | null {
  if (!body.target_company || body.target_company.trim().length === 0) {
    return "target_company is required";
  }

  const company = body.target_company.trim();
  if (company.length < 2 || company.length > 120) {
    return "target_company must be between 2 and 120 characters";
  }

  if (body.limit !== undefined) {
    if (!Number.isFinite(body.limit) || body.limit < 1 || body.limit > 100) {
      return "limit must be a number between 1 and 100";
    }
  }

  if (body.seed_targets && !Array.isArray(body.seed_targets)) {
    return "seed_targets must be an array";
  }

  if (Array.isArray(body.seed_targets) && body.seed_targets.length > 100) {
    return "seed_targets must contain at most 100 entries";
  }

  if (Array.isArray(body.seed_targets)) {
    for (const target of body.seed_targets) {
      if (!target.full_name || target.full_name.trim().length < 2) {
        return "each seed target requires full_name (min 2 chars)";
      }
    }
  }

  return null;
}
