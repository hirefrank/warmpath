import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getDatabase, resetDatabaseForTests } from "../../db";
import { upsertContacts } from "../../db/repositories/contacts";
import { getScoutDiagnosticsByRunId } from "../../db/repositories/second-degree-scout";
import {
  runSecondDegreeScout,
  type ScoutProvider,
  type ScoutProviderTarget,
} from "./second-degree-scout";

class MockScoutProvider implements ScoutProvider {
  readonly name: string;
  private readonly configured: boolean;
  private readonly targets: ScoutProviderTarget[];
  private readonly shouldThrow: boolean;

  constructor(input: {
    name: string;
    configured?: boolean;
    targets?: ScoutProviderTarget[];
    shouldThrow?: boolean;
  }) {
    this.name = input.name;
    this.configured = input.configured ?? true;
    this.targets = input.targets ?? [];
    this.shouldThrow = input.shouldThrow ?? false;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async searchCompanySecondDegree(input: {
    targetCompany: string;
    targetFunction?: string;
    targetTitle?: string;
    limit: number;
  }): Promise<ScoutProviderTarget[]> {
    if (this.shouldThrow) {
      throw new Error(`${this.name} unavailable`);
    }

    return this.targets.slice(0, input.limit);
  }
}

beforeEach(() => {
  process.env.WARMPATH_DB_PATH = `/tmp/warmpath-scout-service-${crypto.randomUUID()}.db`;
  delete process.env.SCOUT_MIN_TARGET_CONFIDENCE;
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  delete process.env.WARMPATH_DB_PATH;
  delete process.env.SCOUT_MIN_TARGET_CONFIDENCE;
});

describe("runSecondDegreeScout provider chain", () => {
  test("falls back to later adapter when first returns no results", async () => {
    const db = getDatabase();

    const result = await runSecondDegreeScout(
      db,
      {
        target_company: "Acme",
        target_function: "product",
        limit: 10,
      },
      [
        new MockScoutProvider({ name: "primary", targets: [] }),
        new MockScoutProvider({
          name: "secondary",
          targets: [
            {
              full_name: "Taylor Candidate",
              current_company: "Acme",
              current_title: "Senior Product Manager",
              confidence: 0.86,
            },
          ],
        }),
      ]
    );

    expect(result.run.status).toBe("completed");
    expect(result.run.source).toBe("secondary");
    expect(result.run.targets).toHaveLength(1);
    expect(result.diagnostics.source).toBe("secondary");
    expect(result.diagnostics.adapter_attempts).toHaveLength(2);
    expect(result.diagnostics.adapter_attempts[0]?.status).toBe("no_results");
    expect(result.diagnostics.adapter_attempts[1]?.status).toBe("success");

    const persistedDiagnostics = getScoutDiagnosticsByRunId(db, result.run.id);
    expect(persistedDiagnostics?.source).toBe("secondary");
    expect(persistedDiagnostics?.adapter_attempts).toHaveLength(2);
    expect(persistedDiagnostics?.adapter_attempts[1]?.status).toBe("success");
  });

  test("returns needs_adapter when all adapters are not configured", async () => {
    const db = getDatabase();

    const result = await runSecondDegreeScout(
      db,
      {
        target_company: "Acme",
      },
      [
        new MockScoutProvider({ name: "primary", configured: false }),
        new MockScoutProvider({ name: "secondary", configured: false }),
      ]
    );

    expect(result.run.status).toBe("needs_adapter");
    expect(result.run.targets).toHaveLength(0);
    expect(result.diagnostics.adapter_attempts).toHaveLength(2);
    expect(result.diagnostics.adapter_attempts.every((attempt) => attempt.status === "not_configured")).toBe(true);
  });

  test("continues chain when an adapter errors", async () => {
    const db = getDatabase();

    const result = await runSecondDegreeScout(
      db,
      {
        target_company: "Acme",
        target_title: "Engineering Manager",
      },
      [
        new MockScoutProvider({ name: "primary", shouldThrow: true }),
        new MockScoutProvider({
          name: "fallback",
          targets: [
            {
              full_name: "Jamie Builder",
              current_company: "Acme",
              current_title: "Engineering Manager",
              confidence: 0.9,
            },
          ],
        }),
      ]
    );

    expect(result.run.status).toBe("completed");
    expect(result.run.source).toBe("fallback");
    expect(result.diagnostics.adapter_attempts[0]?.status).toBe("error");
    expect(result.diagnostics.adapter_attempts[0]?.error).toContain("unavailable");
    expect(result.diagnostics.adapter_attempts[1]?.status).toBe("success");
  });

  test("applies ask guardrails and stores score breakdown", async () => {
    const db = getDatabase();

    upsertContacts(db, [
      {
        name: "Pat Recruiter",
        current_title: "Recruiter",
        current_company: "Acme",
        connected_on: "2015-01-01",
      },
    ]);

    const result = await runSecondDegreeScout(
      db,
      {
        target_company: "Acme",
      },
      [
        new MockScoutProvider({
          name: "seeded",
          targets: [
            {
              full_name: "Riley Candidate",
              current_company: "Acme",
              current_title: "Product Manager",
              confidence: 0.5,
            },
          ],
        }),
      ]
    );

    expect(result.run.status).toBe("completed");
    expect(result.run.connector_paths).toHaveLength(1);
    const path = result.run.connector_paths[0]!;
    expect(path.recommended_ask).toBe("intro");
    expect(path.score_breakdown?.scoring_version).toBe("v2");
    expect(path.score_breakdown?.guardrail_adjustments.length).toBeGreaterThan(0);
    expect(path.score_breakdown?.guardrail_penalty).toBeGreaterThan(0);
  });
});
