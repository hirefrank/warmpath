import { Hono } from "hono";
import { getDatabase } from "./db";
import healthRoute from "./routes/health";
import warmPathContactsRoute from "./routes/warm-path-contacts";
import warmPathJobsRoute from "./routes/warm-path-jobs";
import warmPathRunsRoute from "./routes/warm-path-runs";
import warmPathScoutRoute from "./routes/warm-path-scout";

const app = new Hono();

app.route("/", healthRoute);
app.route("/", warmPathContactsRoute);
app.route("/", warmPathJobsRoute);
app.route("/", warmPathRunsRoute);
app.route("/", warmPathScoutRoute);

app.onError((error, c) => {
  return c.json(
    {
      error: "Internal server error",
      details: error.message,
    },
    500
  );
});

if (import.meta.main) {
  getDatabase();
  const port = Number(Bun.env.PORT ?? 3001);
  Bun.serve({ port, fetch: app.fetch });
  console.log(`WarmPath server running at http://localhost:${port}`);
}

export default app;
