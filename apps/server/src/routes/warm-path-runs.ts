import { Hono } from "hono";
import { rankContacts } from "../lib/scoring/ranker";
import type { ContactSignals, RankedContact } from "../lib/scoring/ranker";
import { getDatabase } from "../db";
import { findContactsByCompany } from "../db/repositories/contacts";
import { getJobById } from "../db/repositories/jobs-cache";
import {
  autoTuneLearningProfile,
  buildLearningSummary,
  ensureDefaultLearningProfile,
  getActiveScoringWeights,
  recordLearningFeedback,
} from "../db/repositories/learning";
import { getWarmPathSettings } from "../db/repositories/app-settings";
import {
  addReminder,
  addWorkflowEntry,
  listReminders,
  listWorkflowTimeline,
  updateReminderStatus,
} from "../db/repositories/outreach-workflow";
import {
  createRun,
  getRunById,
  saveEvent,
  saveResults,
  type WarmPathRunRecord,
} from "../db/repositories/warm-path-runs";
import { normalizeCompanyName } from "../lib/normalize/company";
import { normalizeTitle, titleTokens } from "../lib/normalize/title";
import type {
  AutoTuneResponse,
  DistributionPackResponse,
  LearningOutcome,
  LearningSummaryResponse,
  MessageChannel,
  MessagePackResponse,
  RecordLearningFeedbackRequest,
  OutreachWorkflowStatus,
  OutreachBriefResponse,
  OutreachTone,
  Reminder,
  WorkflowSnapshotResponse,
  WarmPathEvent,
} from "../../../../packages/shared/src/contracts/warm-path";

const app = new Hono();
const MAX_DRAFT_CONTEXT_LENGTH = 600;

app.post("/api/warm-path/rank", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const runId = crypto.randomUUID();
    const settings = getWarmPathSettings(getDatabase()).settings;
    const advisorSlug = String(body.advisor_slug ?? settings.advisor_slug);
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

    const activeWeights = getActiveScoringWeights(database);
    const activeProfile = ensureDefaultLearningProfile(database);
    const topPaths = rankContacts(effectiveSignals, activeWeights).slice(0, 5);

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
      weight_profile: activeProfile,
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

app.get("/api/warm-path/learning/summary", (c) => {
  const summary: LearningSummaryResponse = buildLearningSummary(getDatabase());
  return c.json(summary);
});

app.post("/api/warm-path/learning/feedback", async (c) => {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Partial<RecordLearningFeedbackRequest>;
    const runId = typeof body.run_id === "string" ? body.run_id.trim() : "";
    const colleagueId = typeof body.colleague_id === "string" ? body.colleague_id.trim() : "";
    const outcome = resolveLearningOutcome(body.outcome);

    if (!runId || !colleagueId || !outcome) {
      return c.json({ error: "run_id, colleague_id, and valid outcome are required" }, 400);
    }

    const run = getRunById(getDatabase(), runId);
    if (!run) {
      return c.json({ error: "Run not found" }, 404);
    }

    const feedback = recordLearningFeedback(getDatabase(), {
      runId,
      colleagueId,
      outcome,
      note: typeof body.note === "string" ? body.note.trim() : undefined,
      source: "manual",
    });

    track(getDatabase(), {
      name: "learning_feedback_recorded",
      run_id: runId,
      advisor_slug: run.advisor_slug,
      colleague_id: colleagueId,
      occurred_at: new Date().toISOString(),
    });

    return c.json({ feedback, summary: buildLearningSummary(getDatabase()) });
  } catch (error) {
    return c.json(
      {
        error: "Failed to record learning feedback",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post("/api/warm-path/learning/auto-tune", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const minSamples = typeof body.min_samples === "number" && Number.isFinite(body.min_samples)
      ? Math.max(1, Math.floor(body.min_samples))
      : 5;

    const result = autoTuneLearningProfile(getDatabase(), minSamples);
    if (!result) {
      return c.json({ error: `Not enough samples to auto-tune (need at least ${minSamples}).` }, 400);
    }

    const response: AutoTuneResponse = {
      profile: result.profile,
      used_samples: result.usedSamples,
    };

    track(getDatabase(), {
      name: "learning_profile_activated",
      run_id: "learning",
      advisor_slug: "system",
      occurred_at: new Date().toISOString(),
    });

    return c.json({ ...response, summary: buildLearningSummary(getDatabase()) });
  } catch (error) {
    return c.json(
      {
        error: "Failed to auto-tune learning profile",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post("/api/warm-path/runs/:id/outreach-brief", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const runId = c.req.param("id");
    const briefResult = createOutreachBrief(runId, body);

    if ("error" in briefResult) {
      return c.json({ error: briefResult.error }, briefResult.status);
    }

    track(getDatabase(), {
      name: "outreach_brief_generated",
      run_id: runId,
      advisor_slug: briefResult.run.advisor_slug,
      colleague_id: briefResult.selectedPath.colleague_id,
      occurred_at: new Date().toISOString(),
    });

    return c.json(briefResult.brief);
  } catch (error) {
    return c.json(
      {
        error: "Failed to generate outreach brief",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post("/api/warm-path/runs/:id/message-pack", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const runId = c.req.param("id");
    const briefResult = createOutreachBrief(runId, body);

    if ("error" in briefResult) {
      return c.json({ error: briefResult.error }, briefResult.status);
    }

    const messagePack = buildMessagePack(briefResult.brief);

    track(getDatabase(), {
      name: "message_pack_generated",
      run_id: runId,
      advisor_slug: briefResult.run.advisor_slug,
      colleague_id: briefResult.selectedPath.colleague_id,
      occurred_at: new Date().toISOString(),
    });

    return c.json(messagePack);
  } catch (error) {
    return c.json(
      {
        error: "Failed to generate message pack",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post("/api/warm-path/runs/:id/distribution-pack", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const runId = c.req.param("id");
    const briefResult = createOutreachBrief(runId, body);

    if ("error" in briefResult) {
      return c.json({ error: briefResult.error }, briefResult.status);
    }

    const messagePack = buildMessagePack(briefResult.brief);
    const workflow = getWorkflowSnapshot(runId, briefResult.selectedPath.colleague_id);
    const learningSummary = buildLearningSummary(getDatabase());
    const distributionPack = buildDistributionPack({
      brief: briefResult.brief,
      messagePack,
      workflow,
      learningSummary,
    });

    track(getDatabase(), {
      name: "distribution_pack_generated",
      run_id: runId,
      advisor_slug: briefResult.run.advisor_slug,
      colleague_id: briefResult.selectedPath.colleague_id,
      occurred_at: new Date().toISOString(),
    });

    return c.json(distributionPack);
  } catch (error) {
    return c.json(
      {
        error: "Failed to generate distribution pack",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.get("/api/warm-path/runs/:id/workflow", (c) => {
  const runId = c.req.param("id");
  const colleagueId = c.req.query("colleague_id")?.trim();

  if (!colleagueId) {
    return c.json({ error: "colleague_id is required" }, 400);
  }

  const run = getRunById(getDatabase(), runId);
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }

  const snapshot = getWorkflowSnapshot(runId, colleagueId);
  return c.json(snapshot);
});

app.post("/api/warm-path/runs/:id/workflow/track", async (c) => {
  try {
    const runId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const run = getRunById(getDatabase(), runId);

    if (!run) {
      return c.json({ error: "Run not found" }, 404);
    }

    const colleagueId = typeof body.colleague_id === "string" ? body.colleague_id.trim() : "";
    if (!colleagueId) {
      return c.json({ error: "colleague_id is required" }, 400);
    }

    const status = resolveWorkflowStatus(body.status);
    if (!status) {
      return c.json({ error: "Invalid workflow status" }, 400);
    }

    const channel = resolveMessageChannel(body.channel);
    if (body.channel !== undefined && !channel) {
      return c.json({ error: "Invalid channel" }, 400);
    }

    const note = typeof body.note === "string" ? body.note.trim() : undefined;
    const entry = addWorkflowEntry(getDatabase(), {
      runId,
      colleagueId,
      status,
      channel: channel ?? undefined,
      note: note && note.length > 0 ? note : undefined,
    });

    track(getDatabase(), {
      name: "workflow_status_updated",
      run_id: runId,
      advisor_slug: run.advisor_slug,
      colleague_id: colleagueId,
      occurred_at: new Date().toISOString(),
    });

    const derivedOutcome = learningOutcomeFromWorkflowStatus(status);
    if (derivedOutcome) {
      recordLearningFeedback(getDatabase(), {
        runId,
        colleagueId,
        outcome: derivedOutcome,
        note: note && note.length > 0 ? note : `Derived from workflow status ${status}`,
        source: "workflow",
      });

      track(getDatabase(), {
        name: "learning_feedback_recorded",
        run_id: runId,
        advisor_slug: run.advisor_slug,
        colleague_id: colleagueId,
        occurred_at: new Date().toISOString(),
      });
    }

    return c.json({ entry, snapshot: getWorkflowSnapshot(runId, colleagueId) });
  } catch (error) {
    return c.json(
      {
        error: "Failed to track workflow status",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post("/api/warm-path/runs/:id/reminders", async (c) => {
  try {
    const runId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const run = getRunById(getDatabase(), runId);

    if (!run) {
      return c.json({ error: "Run not found" }, 404);
    }

    const colleagueId = typeof body.colleague_id === "string" ? body.colleague_id.trim() : "";
    if (!colleagueId) {
      return c.json({ error: "colleague_id is required" }, 400);
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return c.json({ error: "message is required" }, 400);
    }

    const channel = resolveMessageChannel(body.channel) ?? "email";
    const dueAt = resolveReminderDueAt(body.due_at, body.offset_days);
    if (!dueAt) {
      return c.json({ error: "Invalid due_at or offset_days" }, 400);
    }

    const reminder = addReminder(getDatabase(), {
      runId,
      colleagueId,
      dueAt,
      channel,
      message,
    });

    track(getDatabase(), {
      name: "reminder_scheduled",
      run_id: runId,
      advisor_slug: run.advisor_slug,
      colleague_id: colleagueId,
      occurred_at: new Date().toISOString(),
    });

    return c.json({ reminder, snapshot: getWorkflowSnapshot(runId, colleagueId) });
  } catch (error) {
    return c.json(
      {
        error: "Failed to schedule reminder",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.patch("/api/warm-path/runs/:id/reminders/:reminderId", async (c) => {
  try {
    const runId = c.req.param("id");
    const reminderId = c.req.param("reminderId");
    const body = await c.req.json().catch(() => ({}));
    const run = getRunById(getDatabase(), runId);

    if (!run) {
      return c.json({ error: "Run not found" }, 404);
    }

    const status = resolveReminderStatus(body.status);
    if (!status) {
      return c.json({ error: "Invalid reminder status" }, 400);
    }

    const reminder = updateReminderStatus(getDatabase(), { reminderId, status });
    if (!reminder || reminder.run_id !== runId) {
      return c.json({ error: "Reminder not found" }, 404);
    }

    return c.json({ reminder, snapshot: getWorkflowSnapshot(runId, reminder.colleague_id) });
  } catch (error) {
    return c.json(
      {
        error: "Failed to update reminder",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.post("/api/warm-path/runs/:id/intro-draft", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const runId = c.req.param("id");
    const briefResult = createOutreachBrief(runId, body);

    if ("error" in briefResult) {
      return c.json({ error: briefResult.error }, briefResult.status);
    }

    const messagePack = buildMessagePack(briefResult.brief);
    const primaryEmail = messagePack.message_variants.find((item) => item.channel === "email");
    const primaryDm = messagePack.message_variants.find((item) => item.channel === "dm");
    const subject = primaryEmail?.subject ??
      briefResult.brief.message_plan.email_subject_options[0] ??
      `Quick favor: ${briefResult.brief.ask_type} for ${briefResult.brief.job.company}`;
    const forwardableEmail = primaryEmail?.body ?? buildForwardableEmail(briefResult.brief);
    const shortDm = primaryDm?.body ?? buildShortDm(briefResult.brief);

    track(getDatabase(), {
      name: "intro_draft_generated",
      run_id: runId,
      advisor_slug: briefResult.run.advisor_slug,
      colleague_id: briefResult.selectedPath.colleague_id,
      occurred_at: new Date().toISOString(),
    });

    addWorkflowEntry(getDatabase(), {
      runId,
      colleagueId: briefResult.selectedPath.colleague_id,
      status: "drafted",
      note: "Generated intro draft package.",
    });

    return c.json({
      run_id: runId,
      colleague_id: briefResult.selectedPath.colleague_id,
      subject,
      forwardable_email: forwardableEmail,
      short_dm: shortDm,
      follow_up_sequence: briefResult.brief.message_plan.follow_up_sequence,
      brief: briefResult.brief,
      message_pack: messagePack,
      applied_context: briefResult.brief.applied_context,
      safety_warnings: briefResult.brief.safety_warnings,
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

function buildForwardableEmail(brief: OutreachBriefResponse): string {
  const contextLine = brief.applied_context
    ? `Context: ${brief.applied_context}\n\n`
    : "";

  const askLine = {
    context: "Would you be open to a quick context chat so I can calibrate before applying?",
    intro: "Would you be open to introducing me to the most relevant hiring partner on your team?",
    referral: "Would you be open to referring me, or sharing the cleanest way to submit with context?",
  }[brief.ask_type];

  const toneLead = {
    warm: "Hope you are doing well.",
    concise: "Hope you're well.",
    direct: "Reaching out directly with a quick ask.",
  }[brief.tone];

  return [
    `Hi ${brief.connector.name},`,
    "",
    `${toneLead} I am exploring ${brief.job.role} opportunities at ${brief.job.company}.`,
    contextLine + askLine,
    "",
    `Why now: ${brief.reason_to_reach_out}`,
    "If useful, I can send a short forwardable blurb and resume summary.",
    "",
    "Thanks so much,",
    "[Your Name]",
  ].join("\n");
}

function buildShortDm(brief: OutreachBriefResponse): string {
  return `Hey ${brief.connector.name} - quick ask: I am exploring ${brief.job.role} at ${brief.job.company}. ${brief.message_plan.dm_hook}`;
}

function buildMessagePack(brief: OutreachBriefResponse): MessagePackResponse {
  const emailSubjectA = brief.message_plan.email_subject_options[0] ??
    `Quick favor: ${brief.ask_type} for ${brief.job.company}`;
  const emailSubjectB = brief.message_plan.email_subject_options[1] ??
    `Quick guidance request about ${brief.job.role}`;

  const variants = [
    {
      id: "email-forwardable",
      channel: "email" as const,
      label: "Forwardable Intro Email",
      subject: emailSubjectA,
      body: buildForwardableEmail(brief),
    },
    {
      id: "email-concise",
      channel: "email" as const,
      label: "Concise Follow-up Email",
      subject: emailSubjectB,
      body: [
        `Hi ${brief.connector.name},`,
        "",
        `Quick follow-up on ${brief.job.role} at ${brief.job.company}.`,
        brief.message_plan.dm_hook,
        "",
        "Thanks again,",
        "[Your Name]",
      ].join("\n"),
    },
    {
      id: "dm-primary",
      channel: "dm" as const,
      label: "Primary DM",
      body: buildShortDm(brief),
    },
    {
      id: "dm-soft-followup",
      channel: "dm" as const,
      label: "Soft Follow-up DM",
      body: `Hey ${brief.connector.name} - following up in case this got buried. Happy to keep it brief and flexible on timing.`,
    },
  ];

  return {
    run_id: brief.run_id,
    colleague_id: brief.colleague_id,
    brief,
    message_variants: variants,
    follow_up_plan: [
      { day: 3, channel: "dm", guidance: "Send a light nudge and restate the low-lift ask." },
      { day: 7, channel: "email", guidance: "Share one concrete fit signal and keep the request explicit." },
      { day: 14, channel: "email", guidance: "Close the loop respectfully and thank them either way." },
    ],
    applied_context: brief.applied_context,
    safety_warnings: brief.safety_warnings,
  };
}

function buildDistributionPack(input: {
  brief: OutreachBriefResponse;
  messagePack: MessagePackResponse;
  workflow: WorkflowSnapshotResponse;
  learningSummary: LearningSummaryResponse;
}): DistributionPackResponse {
  const generatedAt = new Date().toISOString();
  const emailVariant = input.messagePack.message_variants.find((item) => item.channel === "email");
  const dmVariant = input.messagePack.message_variants.find((item) => item.channel === "dm");

  const jsonBundle = JSON.stringify(
    {
      generated_at: generatedAt,
      brief: input.brief,
      message_pack: input.messagePack,
      workflow: input.workflow,
      learning: {
        active_profile: input.learningSummary.active_profile,
        totals: input.learningSummary.totals,
      },
    },
    null,
    2
  );

  const markdownPlaybook = [
    `# Outreach Playbook - ${input.brief.connector.name}`,
    "",
    `- Run: ${input.brief.run_id}`,
    `- Ask type: ${input.brief.ask_type}`,
    `- Objective: ${input.brief.objective}`,
    `- Reason: ${input.brief.reason_to_reach_out}`,
    "",
    "## Primary Email",
    "",
    emailVariant?.subject ? `Subject: ${emailVariant.subject}` : "Subject: (none)",
    "",
    emailVariant?.body ?? "(not available)",
    "",
    "## Primary DM",
    "",
    dmVariant?.body ?? "(not available)",
    "",
    "## Follow-up Plan",
    ...input.messagePack.follow_up_plan.map((step) => `- Day ${step.day} (${step.channel}): ${step.guidance}`),
    "",
    "## Active Learning Profile",
    `- ${input.learningSummary.active_profile.label} (${input.learningSummary.active_profile.source})`,
    `- Weights: company ${input.learningSummary.active_profile.weights.company_affinity}, role ${input.learningSummary.active_profile.weights.role_relevance}, relationship ${input.learningSummary.active_profile.weights.relationship_strength}, context ${input.learningSummary.active_profile.weights.shared_context}, confidence ${input.learningSummary.active_profile.weights.confidence}`,
  ].join("\n");

  const crmNote = [
    `Outreach target: ${input.brief.connector.name} | Company: ${input.brief.job.company} | Role: ${input.brief.job.role}`,
    `Ask type: ${input.brief.ask_type}. Objective: ${input.brief.objective}`,
    `Reason to reach out: ${input.brief.reason_to_reach_out}`,
    `Latest workflow status: ${input.workflow.latest_status ?? "none"}`,
    `Next follow-up: ${input.messagePack.follow_up_plan[0]?.day ? `Day ${input.messagePack.follow_up_plan[0].day}` : "n/a"}`,
  ].join("\n");

  return {
    run_id: input.brief.run_id,
    colleague_id: input.brief.colleague_id,
    generated_at: generatedAt,
    artifacts: [
      {
        mode: "json_bundle",
        title: "Machine-readable outreach bundle",
        content_type: "application/json",
        body: jsonBundle,
      },
      {
        mode: "markdown_playbook",
        title: "Human-readable outreach playbook",
        content_type: "text/markdown",
        body: markdownPlaybook,
      },
      {
        mode: "crm_note",
        title: "CRM update note",
        content_type: "text/plain",
        body: crmNote,
      },
    ],
  };
}

function createOutreachBrief(
  runId: string,
  body: Record<string, unknown>
):
  | { run: WarmPathRunRecord; selectedPath: RankedContact; brief: OutreachBriefResponse }
  | { error: string; status: 400 | 404 } {
  const database = getDatabase();
  const run = getRunById(database, runId);

  if (!run) {
    return { error: "Run not found", status: 404 };
  }

  const selectedId = body.colleague_id ? String(body.colleague_id) : null;
  const selectedPath = selectedId
    ? run.top_paths.find((path) => path.colleague_id === selectedId)
    : run.top_paths[0];

  if (!selectedPath) {
    return { error: "No ranked path available to draft outreach", status: 400 };
  }

  const contextGuardrail = validateAndSanitizeDraftContext(
    typeof body.extra_context === "string" ? body.extra_context : ""
  );
  if (contextGuardrail.blocked_reason) {
    return { error: contextGuardrail.blocked_reason, status: 400 };
  }

  const job = run.job_cache_id ? getJobById(database, run.job_cache_id) : null;
  const company = job?.company ?? "the target company";
  const role = job?.title ?? "a role on the team";
  const tone = resolveOutreachTone(body.tone);

  const brief = buildOutreachBrief({
    runId,
    selectedPath,
    company,
    role,
    tone,
    appliedContext: contextGuardrail.applied_context,
    safetyWarnings: contextGuardrail.warnings,
  });

  return { run, selectedPath, brief };
}

function buildOutreachBrief(input: {
  runId: string;
  selectedPath: {
    colleague_id: string;
    name: string;
    total_score: number;
    company_affinity: number;
    role_relevance: number;
    relationship_strength: number;
    shared_context: number;
    confidence: number;
    recommended_ask: "context" | "intro" | "referral";
    rationale: string;
  };
  company: string;
  role: string;
  tone: OutreachTone;
  appliedContext?: string;
  safetyWarnings: string[];
}): OutreachBriefResponse {
  const evidence = [
    `${input.selectedPath.name} scored ${input.selectedPath.total_score.toFixed(1)} on warm-path fit.`,
    `Company affinity ${input.selectedPath.company_affinity.toFixed(1)} and role relevance ${input.selectedPath.role_relevance.toFixed(1)} support relevance.`,
    `Relationship strength ${input.selectedPath.relationship_strength.toFixed(1)} with shared context ${input.selectedPath.shared_context.toFixed(1)} supports a respectful ask.`,
  ];

  if (input.appliedContext) {
    evidence.push(`Extra context provided: ${input.appliedContext}`);
  }

  const askObjective = {
    context: `Get calibration context for ${input.role} at ${input.company}.`,
    intro: `Secure a warm introduction to the hiring team for ${input.role} at ${input.company}.`,
    referral: `Request a referral path for ${input.role} at ${input.company}.`,
  }[input.selectedPath.recommended_ask];

  const dmHook = {
    context: "Could we do a 10-minute context check this week?",
    intro: "Could you point me to or intro me to the right hiring partner?",
    referral: "If it feels appropriate, would you be open to a referral or the best referral path?",
  }[input.selectedPath.recommended_ask];

  return {
    run_id: input.runId,
    colleague_id: input.selectedPath.colleague_id,
    ask_type: input.selectedPath.recommended_ask,
    tone: input.tone,
    objective: askObjective,
    reason_to_reach_out: input.selectedPath.rationale,
    job: {
      company: input.company,
      role: input.role,
    },
    connector: {
      name: input.selectedPath.name,
      rationale: input.selectedPath.rationale,
      total_score: Number(input.selectedPath.total_score.toFixed(1)),
      confidence: Number(input.selectedPath.confidence.toFixed(1)),
    },
    evidence,
    talking_points: [
      `Signal fit quickly: ${input.selectedPath.rationale}`,
      "Share your target role scope and one relevant impact example.",
      "Close with an easy out and appreciation regardless of outcome.",
    ],
    message_plan: {
      email_subject_options: [
        `Quick favor: ${input.selectedPath.recommended_ask} for ${input.company}`,
        `Looking for quick guidance on ${input.role} at ${input.company}`,
      ],
      dm_hook: dmHook,
      follow_up_sequence: ["day_3", "day_7", "day_14"],
    },
    applied_context: input.appliedContext,
    safety_warnings: input.safetyWarnings.length > 0 ? input.safetyWarnings : undefined,
  };
}

function resolveOutreachTone(value: unknown): OutreachTone {
  if (value === "concise" || value === "direct" || value === "warm") {
    return value;
  }

  return "warm";
}

function resolveMessageChannel(value: unknown): MessageChannel | null {
  if (value === "email" || value === "dm") {
    return value;
  }

  return null;
}

function resolveWorkflowStatus(value: unknown): OutreachWorkflowStatus | null {
  if (
    value === "drafted" ||
    value === "sent" ||
    value === "follow_up_due" ||
    value === "follow_up_sent" ||
    value === "replied" ||
    value === "intro_accepted" ||
    value === "closed"
  ) {
    return value;
  }

  return null;
}

function resolveLearningOutcome(value: unknown): LearningOutcome | null {
  if (
    value === "intro_accepted" ||
    value === "replied" ||
    value === "sent" ||
    value === "follow_up_sent" ||
    value === "no_response" ||
    value === "not_interested"
  ) {
    return value;
  }

  return null;
}

function learningOutcomeFromWorkflowStatus(status: OutreachWorkflowStatus): LearningOutcome | null {
  switch (status) {
    case "intro_accepted":
      return "intro_accepted";
    case "replied":
      return "replied";
    case "sent":
      return "sent";
    case "follow_up_sent":
      return "follow_up_sent";
    case "closed":
      return "not_interested";
    default:
      return null;
  }
}

function resolveReminderStatus(value: unknown): Reminder["status"] | null {
  if (value === "pending" || value === "completed" || value === "cancelled") {
    return value;
  }

  return null;
}

function resolveReminderDueAt(rawDueAt: unknown, rawOffsetDays: unknown): string | null {
  if (typeof rawDueAt === "string") {
    const parsed = Date.parse(rawDueAt);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  if (typeof rawOffsetDays === "number" && Number.isFinite(rawOffsetDays) && rawOffsetDays >= 0) {
    const dueAt = new Date(Date.now() + rawOffsetDays * 24 * 60 * 60 * 1000);
    return dueAt.toISOString();
  }

  return null;
}

function getWorkflowSnapshot(runId: string, colleagueId: string): WorkflowSnapshotResponse {
  const database = getDatabase();
  const timeline = listWorkflowTimeline(database, { runId, colleagueId });
  const reminders = listReminders(database, { runId, colleagueId });

  return {
    run_id: runId,
    colleague_id: colleagueId,
    latest_status: timeline[timeline.length - 1]?.status ?? null,
    timeline,
    reminders,
  };
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

function validateAndSanitizeDraftContext(raw: string): {
  applied_context?: string;
  warnings: string[];
  blocked_reason?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { warnings: [] };
  }

  if (trimmed.length > MAX_DRAFT_CONTEXT_LENGTH) {
    return {
      warnings: [],
      blocked_reason: `extra_context exceeds ${MAX_DRAFT_CONTEXT_LENGTH} characters`,
    };
  }

  if (/(pretend to be|impersonate|forge|fake referral|without consent|bypass process)/i.test(trimmed)) {
    return {
      warnings: [],
      blocked_reason: "extra_context contains unsafe instruction",
    };
  }

  const warnings: string[] = [];
  let sanitized = trimmed.replace(/\s+/g, " ").trim();

  const redactions: Array<{ pattern: RegExp; replacement: string; warning: string }> = [
    {
      pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      replacement: "[redacted-email]",
      warning: "Removed email addresses from draft context.",
    },
    {
      pattern: /(?:\+?\d{1,2}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g,
      replacement: "[redacted-phone]",
      warning: "Removed phone numbers from draft context.",
    },
    {
      pattern: /https?:\/\/(?:www\.)?linkedin\.com\/[\w\-./?=&%]+/gi,
      replacement: "[redacted-linkedin-url]",
      warning: "Removed raw LinkedIn URLs from draft context.",
    },
  ];

  for (const redaction of redactions) {
    const next = sanitized.replace(redaction.pattern, redaction.replacement);
    if (next !== sanitized) {
      warnings.push(redaction.warning);
      sanitized = next;
    }
  }

  if (/guarantee|promise|must refer/i.test(sanitized)) {
    warnings.push("Context includes high-pressure language; keep outreach respectful.");
  }

  return {
    applied_context: sanitized,
    warnings,
  };
}
