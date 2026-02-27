import { Hono } from "hono";
import { fetchNetworkJobs } from "../lib/job-sources/network-jobs";
import { fetchAllJobs } from "../lib/job-sources/all-jobs";
import { getDatabase } from "../db";
import { getWarmPathSettings } from "../db/repositories/app-settings";
import { listJobs, upsertJobs } from "../db/repositories/jobs-cache";

const app = new Hono();

app.post("/api/warm-path/jobs/sync", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const source = body.source === "all" ? "all" : "network";
    const database = getDatabase();
    const settings = getWarmPathSettings(database).settings;
    const advisorSlug = String(body.advisor_slug ?? settings.advisor_slug);
    const category = body.category ?? settings.default_job_category;

    const jobs = source === "all"
      ? await fetchAllJobs({
        category,
        location: body.location,
        seniority: body.seniority,
      })
      : await fetchNetworkJobs({
        advisorSlug,
        category,
        location: body.location,
        seniority: body.seniority,
      });

    upsertJobs(database, jobs);
    const totalCached = listJobs(database, { advisorSlug, source, limit: 5000 }).length;

    return c.json({
      synced: jobs.length,
      source,
      cached_at: new Date().toISOString(),
      total_cached: totalCached,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to sync jobs",
        details: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

app.get("/api/warm-path/jobs", (c) => {
  const advisorSlug = c.req.query("advisor_slug") ?? undefined;
  const company = c.req.query("company") ?? undefined;
  const category = c.req.query("category") ?? undefined;
  const location = c.req.query("location") ?? undefined;
  const source = (c.req.query("source") as "network" | "all" | undefined) ?? undefined;
  const limitRaw = c.req.query("limit");
  const limit = limitRaw ? Number(limitRaw) : 200;

  const jobs = listJobs(getDatabase(), {
    advisorSlug,
    company,
    category,
    location,
    source,
    limit,
  });

  return c.json({
    jobs,
    filters: {
      advisor_slug: advisorSlug ?? null,
      company: company ?? null,
      category: category ?? null,
      location: location ?? null,
      source: source ?? "network",
    },
  });
});

export default app;
