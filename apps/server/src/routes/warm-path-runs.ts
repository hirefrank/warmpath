import { Hono } from "hono";
import { rankContacts } from "../lib/scoring/ranker";
import type { ContactSignals } from "../lib/scoring/ranker";
import { getDatabase } from "../db";
import { findContactsByCompany } from "../db/repositories/contacts";
import { getJobById } from "../db/repositories/jobs-cache";
import {
  createRun,
  getRunById,
  saveEvent,
  saveResults,
} from "../db/repositories/warm-path-runs";
import { normalizeCompanyName } from "../lib/normalize/company";
import { normalizeTitle, titleTokens } from "../lib/normalize/title";
import type { WarmPathEvent } from "../../../../packages/shared/src/contracts/warm-path";

const app = new Hono();

app.post("/api/warm-path/rank", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const runId = crypto.randomUUID();
    const advisorSlug = String(body.advisor_slug ?? "hirefrank");
    const jobCacheId = body.job_cache_id ? String(body.job_cache_id) : undefined;
    const inputSignals = Array.isArray(body.contact_signals)
      ? (body.contact_signals as ContactSignals[])
      : [];
    const database = getDatabase();
    const job = jobCacheId ? getJobById(database, jobCacheId) : null;

    const effectiveSignals = inputSignals.length > 0
      ? inputSignals
      : job
        ? deriveSignalsFromContacts(database, {
          company: job.company,
          title: job.title,
        })
        : [];

    const topPaths = rankContacts(effectiveSignals).slice(0, 5);

    createRun(database, {
      runId,
      advisorSlug,
      jobCacheId,
      seekerName: body.seeker_name ? String(body.seeker_name) : undefined,
      seekerLinkedinUrl: body.seeker_linkedin_url ? String(body.seeker_linkedin_url) : undefined,
    });
    saveResults(database, runId, topPaths);

    track(database, {
      name: "warm_path_ranked",
      run_id: runId,
      advisor_slug: advisorSlug,
      occurred_at: new Date().toISOString(),
    });

    const response: Record<string, unknown> = {
      run_id: runId,
      request: {
        advisor_slug: advisorSlug,
        job_cache_id: jobCacheId ?? null,
      },
      source: inputSignals.length > 0 ? "contact_signals" : "contacts_table",
      top_paths: topPaths,
    };

    if (topPaths.length === 0) {
      response.fallback = [
        "No strong warm paths found yet. Add contact signals or sync additional network data.",
        "Try Build a Path mode next: scout 2nd-degree targets and map mutual connectors.",
      ];
    }

    return c.json(response);
  } catch (error) {
    return c.json(
      {
        error: "Failed to rank warm paths",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.get("/api/warm-path/runs/:id", (c) => {
  const run = getRunById(getDatabase(), c.req.param("id"));
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }

  return c.json({
    run_id: run.run_id,
    top_paths: run.top_paths,
  });
});

app.post("/api/warm-path/runs/:id/intro-draft", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const runId = c.req.param("id");
    const run = getRunById(getDatabase(), runId);

    if (!run) {
      return c.json({ error: "Run not found" }, 404);
    }

    const selectedId = body.colleague_id ? String(body.colleague_id) : null;
    const selectedPath = selectedId
      ? run.top_paths.find((path) => path.colleague_id === selectedId)
      : run.top_paths[0];

    if (!selectedPath) {
      return c.json({ error: "No ranked path available to draft outreach" }, 400);
    }

    const job = run.job_cache_id ? getJobById(getDatabase(), run.job_cache_id) : null;
    const company = job?.company ?? "the target company";
    const role = job?.title ?? "a role on the team";
    const askType = selectedPath.recommended_ask;

    const subject = `Quick favor: ${askType} for ${company}`;
    const forwardableEmail = buildForwardableEmail({
      colleagueName: selectedPath.name,
      company,
      role,
      askType,
      extraContext: typeof body.extra_context === "string" ? body.extra_context : undefined,
    });
    const shortDm = buildShortDm({
      colleagueName: selectedPath.name,
      company,
      role,
      askType,
    });

    track(getDatabase(), {
      name: "intro_draft_generated",
      run_id: runId,
      advisor_slug: run.advisor_slug,
      colleague_id: selectedPath.colleague_id,
      occurred_at: new Date().toISOString(),
    });

    return c.json({
      run_id: runId,
      colleague_id: selectedPath.colleague_id,
      subject,
      forwardable_email: forwardableEmail,
      short_dm: shortDm,
      follow_up_sequence: ["day_3", "day_7", "day_14"],
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to generate intro draft",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

export default app;

function track(database: ReturnType<typeof getDatabase>, event: WarmPathEvent): void {
  saveEvent(database, event);
}

function buildForwardableEmail(input: {
  colleagueName: string;
  company: string;
  role: string;
  askType: "context" | "intro" | "referral";
  extraContext?: string;
}): string {
  const contextLine = input.extraContext
    ? `Context: ${input.extraContext}\n\n`
    : "";

  return [
    `Hi ${input.colleagueName},`,
    "",
    `Hope you are doing well. I am exploring ${input.role} opportunities at ${input.company}.`,
    contextLine + `Would you be open to a quick ${input.askType} conversation or pointing me to the best person on the team?`,
    "",
    "I can share a short background blurb you can forward if useful.",
    "",
    "Thanks so much,",
    "[Your Name]",
  ].join("\n");
}

function buildShortDm(input: {
  colleagueName: string;
  company: string;
  role: string;
  askType: "context" | "intro" | "referral";
}): string {
  return `Hey ${input.colleagueName} - quick ask: I am exploring ${input.role} at ${input.company}. Would you be open to a brief ${input.askType} chat or a pointer to the right person?`;
}

function deriveSignalsFromContacts(
  database: ReturnType<typeof getDatabase>,
  target: { company: string; title: string }
): ContactSignals[] {
  const targetCompany = normalizeCompanyName(target.company);
  const targetTitleTokens = new Set(titleTokens(target.title));
  const contacts = findContactsByCompany(database, target.company);

  return contacts.map((contact) => {
    const contactCompany = normalizeCompanyName(contact.current_company ?? "");
    const contactTitleNormalized = normalizeTitle(contact.current_title ?? "");
    const overlapCount = titleTokens(contact.current_title ?? "").filter((token) => targetTitleTokens.has(token)).length;
    const recruitingBoost = /recruit|talent|people/.test(contactTitleNormalized) ? 8 : 0;

    const companyAffinity = contactCompany === targetCompany ? 35 : 24;
    const roleRelevance = Math.min(25, overlapCount * 6 + 8 + recruitingBoost);
    const relationshipStrength = estimateRelationshipStrength(contact.connected_on);
    const sharedContext = overlapCount > 0 ? Math.min(15, 6 + overlapCount * 2) : 6;
    const confidence = Math.min(
      5,
      (contact.current_title ? 2 : 0) +
      (contact.current_company ? 2 : 0) +
      (contact.linkedin_url ? 1 : 0)
    );

    return {
      colleagueId: contact.id,
      name: contact.name,
      title: contact.current_title ?? "",
      companyAffinity,
      roleRelevance,
      relationshipStrength,
      sharedContext,
      confidence,
    };
  });
}

function estimateRelationshipStrength(connectedOn: string | null): number {
  if (!connectedOn) return 8;
  const parsed = Date.parse(connectedOn);
  if (Number.isNaN(parsed)) return 8;

  const days = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
  if (days <= 365) return 18;
  if (days <= 365 * 3) return 14;
  if (days <= 365 * 7) return 10;
  return 7;
}
