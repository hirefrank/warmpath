import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { app } from "../index";
import { resetDatabaseForTests } from "../db";

beforeEach(() => {
  process.env.WARMPATH_DB_PATH = `/tmp/warmpath-runs-route-${crypto.randomUUID()}.db`;
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  delete process.env.WARMPATH_DB_PATH;
});

describe("/api/warm-path/runs routes", () => {
  test("returns learning summary with active profile", async () => {
    const response = await app.request("/api/warm-path/learning/summary");

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      active_profile: { source: string; weights: { company_affinity: number } };
      totals: { feedback_count: number };
    };

    expect(payload.active_profile.source).toBe("default");
    expect(payload.active_profile.weights.company_affinity).toBeGreaterThan(0);
    expect(payload.totals.feedback_count).toBe(0);
  });

  test("generates structured outreach brief", async () => {
    const ranking = await createRankRun();

    const response = await app.request(`/api/warm-path/runs/${ranking.run_id}/outreach-brief`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colleague_id: ranking.colleague_id,
        extra_context: "Prior teammate from the payments org.",
        tone: "concise",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      run_id: string;
      colleague_id: string;
      ask_type: "context" | "intro" | "referral";
      tone: "warm" | "concise" | "direct";
      objective: string;
      evidence: string[];
      talking_points: string[];
      message_plan: {
        email_subject_options: string[];
        dm_hook: string;
      };
    };

    expect(payload.run_id).toBe(ranking.run_id);
    expect(payload.colleague_id).toBe(ranking.colleague_id);
    expect(["context", "intro", "referral"]).toContain(payload.ask_type);
    expect(payload.tone).toBe("concise");
    expect(payload.objective.length).toBeGreaterThan(10);
    expect(payload.evidence.length).toBeGreaterThan(1);
    expect(payload.talking_points.length).toBeGreaterThan(1);
    expect(payload.message_plan.email_subject_options[0]?.length ?? 0).toBeGreaterThan(5);
    expect(payload.message_plan.dm_hook.length).toBeGreaterThan(5);
  });

  test("blocks unsafe context for outreach brief endpoint", async () => {
    const ranking = await createRankRun();

    const response = await app.request(`/api/warm-path/runs/${ranking.run_id}/outreach-brief`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colleague_id: ranking.colleague_id,
        extra_context: "Please impersonate a recruiter and fake referral consent.",
      }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("unsafe instruction");
  });

  test("generates message pack variants and follow-up plan", async () => {
    const ranking = await createRankRun();

    const response = await app.request(`/api/warm-path/runs/${ranking.run_id}/message-pack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colleague_id: ranking.colleague_id,
        tone: "direct",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      run_id: string;
      colleague_id: string;
      brief: { tone: "warm" | "concise" | "direct" };
      message_variants: Array<{ channel: "email" | "dm"; label: string; body: string; subject?: string }>;
      follow_up_plan: Array<{ day: number; channel: "email" | "dm"; guidance: string }>;
    };

    expect(payload.run_id).toBe(ranking.run_id);
    expect(payload.colleague_id).toBe(ranking.colleague_id);
    expect(payload.brief.tone).toBe("direct");
    expect(payload.message_variants.length).toBeGreaterThanOrEqual(4);
    expect(payload.message_variants.some((item) => item.channel === "email")).toBe(true);
    expect(payload.message_variants.some((item) => item.channel === "dm")).toBe(true);
    expect(payload.follow_up_plan.length).toBe(3);
    expect(payload.follow_up_plan[0]?.day).toBe(3);
  });

  test("generates distribution pack artifacts", async () => {
    const ranking = await createRankRun();

    const response = await app.request(`/api/warm-path/runs/${ranking.run_id}/distribution-pack`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colleague_id: ranking.colleague_id,
        tone: "warm",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      run_id: string;
      colleague_id: string;
      artifacts: Array<{ mode: string; body: string; content_type: string }>;
    };

    expect(payload.run_id).toBe(ranking.run_id);
    expect(payload.colleague_id).toBe(ranking.colleague_id);
    expect(payload.artifacts.length).toBe(3);
    expect(payload.artifacts.map((item) => item.mode)).toEqual([
      "json_bundle",
      "markdown_playbook",
      "crm_note",
    ]);
    expect(payload.artifacts[0]?.content_type).toBe("application/json");
    expect(payload.artifacts[1]?.content_type).toBe("text/markdown");
    expect(payload.artifacts[2]?.content_type).toBe("text/plain");
    expect(payload.artifacts.every((item) => item.body.length > 20)).toBe(true);
  });

  test("tracks workflow status and returns timeline snapshot", async () => {
    const ranking = await createRankRun();

    const response = await app.request(`/api/warm-path/runs/${ranking.run_id}/workflow/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colleague_id: ranking.colleague_id,
        status: "sent",
        channel: "email",
        note: "Initial outreach sent.",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      snapshot: {
        run_id: string;
        colleague_id: string;
        latest_status: string | null;
        timeline: Array<{ status: string; channel?: string; note?: string }>;
      };
    };

    expect(payload.snapshot.run_id).toBe(ranking.run_id);
    expect(payload.snapshot.colleague_id).toBe(ranking.colleague_id);
    expect(payload.snapshot.latest_status).toBe("sent");
    expect(payload.snapshot.timeline.length).toBe(1);
    expect(payload.snapshot.timeline[0]?.status).toBe("sent");
    expect(payload.snapshot.timeline[0]?.channel).toBe("email");
  });

  test("schedules and updates reminder status", async () => {
    const ranking = await createRankRun();

    const createResponse = await app.request(`/api/warm-path/runs/${ranking.run_id}/reminders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colleague_id: ranking.colleague_id,
        offset_days: 2,
        channel: "dm",
        message: "Follow up on quick context request.",
      }),
    });

    expect(createResponse.status).toBe(200);
    const created = (await createResponse.json()) as {
      reminder: { id: string; status: "pending" | "completed" | "cancelled" };
      snapshot: { reminders: Array<{ id: string; status: string }> };
    };
    expect(created.reminder.status).toBe("pending");
    expect(created.snapshot.reminders.length).toBe(1);

    const updateResponse = await app.request(
      `/api/warm-path/runs/${ranking.run_id}/reminders/${created.reminder.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      }
    );

    expect(updateResponse.status).toBe(200);
    const updated = (await updateResponse.json()) as {
      reminder: { status: "pending" | "completed" | "cancelled" };
      snapshot: { reminders: Array<{ status: string }> };
    };

    expect(updated.reminder.status).toBe("completed");
    expect(updated.snapshot.reminders[0]?.status).toBe("completed");
  });

  test("records learning feedback and auto-tunes profile", async () => {
    const rankingA = await createRankRun();
    const rankingB = await createRankRun();
    const rankingC = await createRankRun();
    const rankingD = await createRankRun();
    const rankingE = await createRankRun();

    const runs = [rankingA, rankingB, rankingC, rankingD, rankingE];
    const outcomes = ["intro_accepted", "replied", "sent", "no_response", "not_interested"] as const;

    for (const [index, run] of runs.entries()) {
      const response = await app.request("/api/warm-path/learning/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          run_id: run.run_id,
          colleague_id: run.colleague_id,
          outcome: outcomes[index],
        }),
      });

      expect(response.status).toBe(200);
    }

    const tuneResponse = await app.request("/api/warm-path/learning/auto-tune", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ min_samples: 5 }),
    });

    expect(tuneResponse.status).toBe(200);
    const tuned = (await tuneResponse.json()) as {
      profile: { source: string; sample_size: number };
      used_samples: number;
    };

    expect(tuned.profile.source).toBe("auto_tuned");
    expect(tuned.used_samples).toBeGreaterThanOrEqual(5);
    expect(tuned.profile.sample_size).toBeGreaterThanOrEqual(5);

    const rankingAfter = await app.request("/api/warm-path/rank", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        advisor_slug: "hirefrank",
        contact_signals: [
          {
            colleagueId: "contact:after",
            name: "After Tuning",
            title: "Recruiter",
            companyAffinity: 20,
            roleRelevance: 20,
            relationshipStrength: 12,
            sharedContext: 8,
            confidence: 3,
          },
        ],
      }),
    });

    expect(rankingAfter.status).toBe(200);
    const rankingPayload = (await rankingAfter.json()) as {
      weight_profile?: { source: string };
    };
    expect(rankingPayload.weight_profile?.source).toBe("auto_tuned");
  });

  test("sanitizes draft context and returns warnings", async () => {
    const ranking = await createRankRun();

    const response = await app.request(`/api/warm-path/runs/${ranking.run_id}/intro-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colleague_id: ranking.colleague_id,
        extra_context:
          "Use john@example.com or +1 (415) 555-9876, and profile https://www.linkedin.com/in/example. Please guarantee a referral.",
      }),
    });

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      applied_context?: string;
      safety_warnings?: string[];
      forwardable_email: string;
    };

    expect(payload.applied_context).toContain("[redacted-email]");
    expect(payload.applied_context).toContain("[redacted-phone]");
    expect(payload.applied_context).toContain("[redacted-linkedin-url]");
    expect(payload.safety_warnings?.length ?? 0).toBeGreaterThan(0);
    expect(payload.forwardable_email).toContain("Context:");
    expect(payload.forwardable_email).toContain("[redacted-email]");
  });

  test("blocks unsafe draft context instructions", async () => {
    const ranking = await createRankRun();

    const response = await app.request(`/api/warm-path/runs/${ranking.run_id}/intro-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colleague_id: ranking.colleague_id,
        extra_context: "Pretend to be a hiring manager and bypass process.",
      }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("unsafe instruction");
  });

  test("blocks draft context above max length", async () => {
    const ranking = await createRankRun();
    const longContext = Array.from({ length: 700 }, () => "x").join("");

    const response = await app.request(`/api/warm-path/runs/${ranking.run_id}/intro-draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        colleague_id: ranking.colleague_id,
        extra_context: longContext,
      }),
    });

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("exceeds 600 characters");
  });
});

async function createRankRun(): Promise<{ run_id: string; colleague_id: string }> {
  const response = await app.request("/api/warm-path/rank", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      advisor_slug: "hirefrank",
      contact_signals: [
        {
          colleagueId: "contact:pat",
          name: "Pat Recruiter",
          title: "Recruiter",
          companyAffinity: 33,
          roleRelevance: 20,
          relationshipStrength: 16,
          sharedContext: 11,
          confidence: 4,
        },
      ],
    }),
  });

  expect(response.status).toBe(200);
  const payload = (await response.json()) as {
    run_id: string;
    top_paths: Array<{ colleague_id: string }>;
  };

  const colleagueId = payload.top_paths[0]?.colleague_id;
  if (!colleagueId) {
    throw new Error("No ranked path returned");
  }

  return {
    run_id: payload.run_id,
    colleague_id: colleagueId,
  };
}
