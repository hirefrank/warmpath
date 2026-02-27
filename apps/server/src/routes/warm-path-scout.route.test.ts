import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { app } from "../index";
import { resetDatabaseForTests } from "../db";

beforeEach(() => {
  process.env.WARMPATH_DB_PATH = `/tmp/warmpath-scout-route-${crypto.randomUUID()}.db`;
  delete process.env.LINKEDIN_LI_AT;
  delete process.env.LINKEDIN_LI_AT_COOKIE;
  delete process.env.LI_AT;
  delete process.env.SCOUT_STATIC_TARGETS_JSON;
  delete process.env.SCOUT_PROVIDER_ORDER;
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  delete process.env.WARMPATH_DB_PATH;
  delete process.env.LINKEDIN_LI_AT;
  delete process.env.LINKEDIN_LI_AT_COOKIE;
  delete process.env.LI_AT;
  delete process.env.SCOUT_STATIC_TARGETS_JSON;
  delete process.env.SCOUT_PROVIDER_ORDER;
});

describe("/api/warm-path/scout routes", () => {
  test("returns 400 when target_company is missing", async () => {
    const response = await app.request("/api/warm-path/scout/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_function: "product" }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toBe("target_company is required");
  });

  test("creates completed scout run from seed targets", async () => {
    const importResponse = await app.request("/api/warm-path/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contacts: [
          {
            name: "Casey Connector",
            current_title: "Senior Recruiter",
            current_company: "Acme",
          },
        ],
      }),
    });

    expect(importResponse.status).toBe(200);

    const runResponse = await app.request("/api/warm-path/scout/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_company: "Acme",
        target_function: "product",
        seed_targets: [
          {
            full_name: "Taylor Candidate",
            current_title: "Senior Product Manager",
            current_company: "Acme",
            confidence: 0.8,
          },
        ],
      }),
    });

    expect(runResponse.status).toBe(200);
    const runPayload = (await runResponse.json()) as {
      run: {
        id: string;
        source: string;
        status: string;
        targets: unknown[];
        connector_paths: unknown[];
      };
      diagnostics: {
        source: string;
        adapter_attempts: Array<{ adapter: string; status: string; result_count: number }>;
      };
    };

    expect(runPayload.run.status).toBe("completed");
    expect(runPayload.run.source).toBe("seed_targets");
    expect(runPayload.run.targets).toHaveLength(1);
    expect(runPayload.run.connector_paths).toHaveLength(1);
    expect(runPayload.diagnostics.source).toBe("seed_targets");
    expect(runPayload.diagnostics.adapter_attempts[0]?.adapter).toBe("seed_targets");
    expect(runPayload.diagnostics.adapter_attempts[0]?.status).toBe("success");

    const detailResponse = await app.request(
      `/api/warm-path/scout/runs/${runPayload.run.id}`
    );
    expect(detailResponse.status).toBe(200);

    const detailPayload = (await detailResponse.json()) as {
      run: { id: string; status: string };
      diagnostics?: {
        source: string;
        adapter_attempts: Array<{ adapter: string; status: string; result_count: number }>;
      };
    };
    expect(detailPayload.run.id).toBe(runPayload.run.id);
    expect(detailPayload.run.status).toBe("completed");
    expect(detailPayload.diagnostics?.source).toBe("seed_targets");
    expect(detailPayload.diagnostics?.adapter_attempts[0]?.adapter).toBe("seed_targets");
  });

  test("prioritizes strongest mutual connector paths", async () => {
    const importResponse = await app.request("/api/warm-path/contacts/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contacts: [
          {
            name: "Casey Recruiter",
            current_title: "Senior Recruiter",
            current_company: "Acme",
            connected_on: "2025-01-10",
          },
          {
            name: "Robin Engineer",
            current_title: "Software Engineer",
            current_company: "Acme",
            connected_on: "2026-01-10",
          },
        ],
      }),
    });

    expect(importResponse.status).toBe(200);

    const runResponse = await app.request("/api/warm-path/scout/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_company: "Acme",
        target_function: "product",
        seed_targets: [
          {
            full_name: "Taylor Candidate",
            current_title: "Senior Product Manager",
            current_company: "Acme",
            confidence: 0.82,
          },
        ],
      }),
    });

    expect(runResponse.status).toBe(200);
    const payload = (await runResponse.json()) as {
      run: {
        connector_paths: Array<{
          connector_name: string;
          recommended_ask?: string;
          path_score: number;
          score_breakdown?: {
            scoring_version: string;
            quality_tier: string;
          };
        }>;
      };
    };

    expect(payload.run.connector_paths).toHaveLength(2);
    expect(payload.run.connector_paths[0]?.connector_name).toBe("Casey Recruiter");
    expect(payload.run.connector_paths[0]?.recommended_ask).toBe("referral");
    expect(payload.run.connector_paths[0]?.score_breakdown?.scoring_version).toBe("v2");
    expect(payload.run.connector_paths[0]?.score_breakdown?.quality_tier).toBe("medium");
    expect((payload.run.connector_paths[0]?.path_score ?? 0)).toBeGreaterThan(
      payload.run.connector_paths[1]?.path_score ?? 0
    );
  });

  test("returns needs_adapter when no cookie and no seeds", async () => {
    const response = await app.request("/api/warm-path/scout/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_company: "Acme", target_function: "product" }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      run: { id: string; status: string };
      notes?: string;
      diagnostics: {
        source: string;
        adapter_attempts: Array<{ adapter: string; status: string; result_count: number }>;
      };
    };

    expect(payload.run.status).toBe("needs_adapter");
    expect(payload.notes).toContain("configure at least one scout provider");
    expect(payload.diagnostics.source).toBe("linkedin_li_at");
    expect(payload.diagnostics.adapter_attempts[0]?.adapter).toBe("linkedin_li_at");
    expect(payload.diagnostics.adapter_attempts[0]?.status).toBe("not_configured");

    const detailResponse = await app.request(`/api/warm-path/scout/runs/${payload.run.id}`);
    expect(detailResponse.status).toBe(200);
    const detailPayload = (await detailResponse.json()) as {
      diagnostics?: {
        source: string;
        adapter_attempts: Array<{ adapter: string; status: string }>;
      };
    };
    expect(detailPayload.diagnostics?.source).toBe("linkedin_li_at");
    expect(detailPayload.diagnostics?.adapter_attempts[0]?.status).toBe("not_configured");
  });

  test("uses static fallback provider when configured", async () => {
    process.env.SCOUT_STATIC_TARGETS_JSON = JSON.stringify([
      {
        full_name: "Jordan Builder",
        current_company: "Acme",
        current_title: "Senior Product Manager",
        confidence: 0.87,
      },
    ]);

    const response = await app.request("/api/warm-path/scout/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_company: "Acme", target_function: "product" }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      run: {
        status: string;
        source: string;
        targets: unknown[];
      };
      diagnostics: {
        source: string;
        adapter_attempts: Array<{ adapter: string; status: string; result_count: number }>;
      };
    };

    expect(payload.run.status).toBe("completed");
    expect(payload.run.source).toBe("static_seed");
    expect(payload.run.targets).toHaveLength(1);
    expect(payload.diagnostics.source).toBe("static_seed");
    expect(payload.diagnostics.adapter_attempts[0]?.adapter).toBe("linkedin_li_at");
    expect(payload.diagnostics.adapter_attempts[0]?.status).toBe("not_configured");
    expect(payload.diagnostics.adapter_attempts[1]?.adapter).toBe("static_seed");
    expect(payload.diagnostics.adapter_attempts[1]?.status).toBe("success");
  });

  test("returns 400 for invalid limit", async () => {
    const response = await app.request("/api/warm-path/scout/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_company: "Acme", limit: 999 }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("limit must be a number between 1 and 100");
  });

  test("returns 400 when too many seed targets are provided", async () => {
    const seedTargets = Array.from({ length: 101 }, (_, idx) => ({ full_name: `Person ${idx}` }));
    const response = await app.request("/api/warm-path/scout/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_company: "Acme", seed_targets: seedTargets }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("seed_targets must contain at most 100 entries");
  });

  test("returns scout stats by status and source", async () => {
    await app.request("/api/warm-path/scout/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_company: "Acme",
        seed_targets: [{ full_name: "Taylor Candidate", current_company: "Acme" }],
      }),
    });

    await app.request("/api/warm-path/scout/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target_company: "Bravo" }),
    });

    const statsResponse = await app.request("/api/warm-path/scout/stats");
    expect(statsResponse.status).toBe(200);

    const payload = (await statsResponse.json()) as {
      stats: {
        total: number;
        by_status: Record<string, number>;
        by_source: Record<string, number>;
      };
    };

    expect(payload.stats.total).toBe(2);
    expect(payload.stats.by_status.completed).toBe(1);
    expect(payload.stats.by_status.needs_adapter).toBe(1);
    expect(payload.stats.by_source.seed_targets).toBe(1);
    expect(payload.stats.by_source.linkedin_li_at).toBe(1);

    const runsResponse = await app.request("/api/warm-path/scout/runs?limit=5");
    expect(runsResponse.status).toBe(200);
    const runsPayload = (await runsResponse.json()) as {
      runs: Array<{
        id: string;
        diagnostics_summary?: {
          source: string;
          adapter_count: number;
          success_count: number;
          error_count: number;
          not_configured_count: number;
        };
      }>;
    };

    expect(runsPayload.runs).toHaveLength(2);
    const withSeedTargets = runsPayload.runs.find(
      (run) => run.diagnostics_summary?.source === "seed_targets"
    );
    expect(withSeedTargets?.diagnostics_summary?.success_count).toBe(1);

    const withMissingAdapters = runsPayload.runs.find(
      (run) => run.diagnostics_summary?.source === "linkedin_li_at"
    );
    expect(withMissingAdapters?.diagnostics_summary?.not_configured_count).toBeGreaterThan(0);
  });
});
