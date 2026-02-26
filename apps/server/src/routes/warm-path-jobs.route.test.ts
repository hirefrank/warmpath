import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import app from "../index";
import { resetDatabaseForTests } from "../db";
import {
  fixtureManifest,
  fixtureProductJobs,
} from "../lib/job-sources/__fixtures__/network-jobs-fixtures";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.WARMPATH_DB_PATH = `/tmp/warmpath-jobs-route-${crypto.randomUUID()}.db`;
  resetDatabaseForTests();
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetDatabaseForTests();
  delete process.env.WARMPATH_DB_PATH;
});

describe("/api/warm-path/jobs routes", () => {
  test("syncs network jobs and returns persisted filtered jobs", async () => {
    const base = "https://jobs.hirefrank.com/hirefrank";

    globalThis.fetch = mockFetch({
      [`${base}/manifest.json`]: jsonResponse(fixtureManifest),
      [`${base}/product.json`]: jsonResponse(fixtureProductJobs),
    });

    const syncResponse = await app.request("/api/warm-path/jobs/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        advisor_slug: "hirefrank",
        category: "product",
        source: "network",
      }),
    });

    expect(syncResponse.status).toBe(200);
    const syncPayload = (await syncResponse.json()) as {
      synced: number;
      total_cached: number;
      source: string;
    };

    expect(syncPayload.source).toBe("network");
    expect(syncPayload.synced).toBe(2);
    expect(syncPayload.total_cached).toBe(2);

    const listResponse = await app.request(
      "/api/warm-path/jobs?advisor_slug=hirefrank&category=product"
    );

    expect(listResponse.status).toBe(200);
    const listPayload = (await listResponse.json()) as {
      jobs: Array<{ id: string; company: string; title: string }>;
    };

    expect(listPayload.jobs).toHaveLength(2);
    expect(listPayload.jobs.map((job) => job.id)).toEqual([
      "hirefrank:network:101",
      "hirefrank:network:102",
    ]);
  });

  test("returns 500 when sync fails", async () => {
    const base = "https://jobs.hirefrank.com/hirefrank";

    globalThis.fetch = mockFetch({
      [`${base}/manifest.json`]: jsonResponse({ error: "down" }, 500),
    });

    const response = await app.request("/api/warm-path/jobs/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ advisor_slug: "hirefrank", category: "product" }),
    });

    expect(response.status).toBe(500);
    const payload = (await response.json()) as { error: string; details: string };
    expect(payload.error).toBe("Failed to sync jobs");
    expect(payload.details).toContain("Failed to fetch manifest");
  });
});

function jsonResponse(payload: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(routes: Record<string, Response>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const response = routes[url];
    if (!response) {
      return new Response("not found", { status: 404 });
    }

    return response.clone();
  }) as typeof fetch;
}
