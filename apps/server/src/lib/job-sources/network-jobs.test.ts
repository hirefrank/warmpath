import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  fixtureEngineeringJobs,
  fixtureManifest,
  fixtureProductJobs,
  fixtureProductNycSeniorJobs,
} from "./__fixtures__/network-jobs-fixtures";
import { fetchNetworkJobs } from "./network-jobs";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("fetchNetworkJobs", () => {
  test("fetches granular and category files, then dedupes by job id", async () => {
    const calls: string[] = [];
    const base = "https://jobs.hirefrank.com/hirefrank";

    globalThis.fetch = mockFetch(
      {
        [`${base}/manifest.json`]: jsonResponse(fixtureManifest),
        [`${base}/product-nyc-senior.json`]: jsonResponse(fixtureProductNycSeniorJobs),
        [`${base}/product.json`]: jsonResponse(fixtureProductJobs),
      },
      calls
    );

    const result = await fetchNetworkJobs({
      advisorSlug: "hirefrank",
      category: "product",
      location: "nyc",
      seniority: "senior",
    });

    expect(calls).toContain(`${base}/manifest.json`);
    expect(calls).toContain(`${base}/product-nyc-senior.json`);
    expect(calls).toContain(`${base}/product.json`);

    expect(result).toHaveLength(3);
    expect(new Set(result.map((job) => job.externalJobId))).toEqual(
      new Set([101, 102, 103])
    );
  });

  test("fetches all manifest categories when no category filter is provided", async () => {
    const base = "https://jobs.hirefrank.com/hirefrank";

    globalThis.fetch = mockFetch({
      [`${base}/manifest.json`]: jsonResponse(fixtureManifest),
      [`${base}/product.json`]: jsonResponse(fixtureProductJobs),
      [`${base}/engineering.json`]: jsonResponse(fixtureEngineeringJobs),
    });

    const result = await fetchNetworkJobs({ advisorSlug: "hirefrank" });

    expect(result).toHaveLength(3);
    expect(new Set(result.map((job) => job.externalJobId))).toEqual(
      new Set([101, 102, 201])
    );
  });

  test("throws when manifest request fails", async () => {
    const base = "https://jobs.hirefrank.com/hirefrank";

    globalThis.fetch = mockFetch({
      [`${base}/manifest.json`]: jsonResponse({ error: "nope" }, 500),
    });

    await expect(fetchNetworkJobs({ advisorSlug: "hirefrank" })).rejects.toThrow(
      "Failed to fetch manifest"
    );
  });
});

function jsonResponse(payload: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function mockFetch(
  routes: Record<string, Response>,
  calls: string[] = []
): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);

    const response = routes[url];
    if (!response) {
      return new Response("not found", { status: 404 });
    }

    return response.clone();
  }) as typeof fetch;
}
