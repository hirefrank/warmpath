import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { app } from "../index";
import { resetDatabaseForTests } from "../db";

beforeEach(() => {
  process.env.WARMPATH_DB_PATH = `/tmp/warmpath-settings-route-${crypto.randomUUID()}.db`;
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

describe("/api/warm-path/settings routes", () => {
  test("returns default settings", async () => {
    const response = await app.request("/api/warm-path/settings");
    expect(response.status).toBe(200);

    const payload = (await response.json()) as {
      settings: {
        advisor_slug: string;
        default_job_category: string;
        scout_provider_order: string;
      };
      hints: {
        linkedin_configured: boolean;
      };
    };

    expect(payload.settings.advisor_slug).toBe("hirefrank");
    expect(payload.settings.default_job_category).toBe("product");
    expect(payload.settings.scout_provider_order).toContain("linkedin_li_at");
    expect(payload.hints.linkedin_configured).toBe(false);
  });

  test("updates settings and uses them in scout runs", async () => {
    const updateResponse = await app.request("/api/warm-path/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        settings: {
          advisor_slug: "advisor-demo",
          default_job_category: "engineering",
          scout_provider_order: "static_seed",
          scout_static_targets_json: JSON.stringify([
            {
              full_name: "Jordan Builder",
              current_company: "Acme",
              current_title: "Senior Product Manager",
              confidence: 0.86,
            },
          ]),
        },
      }),
    });

    expect(updateResponse.status).toBe(200);
    const updatedPayload = (await updateResponse.json()) as {
      settings: {
        advisor_slug: string;
        default_job_category: string;
      };
      hints: {
        static_seed_configured: boolean;
      };
    };
    expect(updatedPayload.settings.advisor_slug).toBe("advisor-demo");
    expect(updatedPayload.settings.default_job_category).toBe("engineering");
    expect(updatedPayload.hints.static_seed_configured).toBe(true);

    const scoutResponse = await app.request("/api/warm-path/scout/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target_company: "Acme",
        target_function: "product",
      }),
    });

    expect(scoutResponse.status).toBe(200);
    const scoutPayload = (await scoutResponse.json()) as {
      run: {
        status: string;
        source: string;
        targets: unknown[];
      };
    };

    expect(scoutPayload.run.status).toBe("completed");
    expect(scoutPayload.run.source).toBe("static_seed");
    expect(scoutPayload.run.targets).toHaveLength(1);
  });
});
