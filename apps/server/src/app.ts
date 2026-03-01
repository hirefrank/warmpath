import { Hono } from "hono";
import healthRoute from "./routes/health";
import warmPathContactsRoute from "./routes/warm-path-contacts";
import warmPathJobsRoute from "./routes/warm-path-jobs";
import warmPathRunsRoute from "./routes/warm-path-runs";
import warmPathScoutRoute from "./routes/warm-path-scout";
import warmPathSettingsRoute from "./routes/warm-path-settings";

export const app = new Hono();

app.route("/", healthRoute);
app.route("/", warmPathContactsRoute);
app.route("/", warmPathJobsRoute);
app.route("/", warmPathRunsRoute);
app.route("/", warmPathScoutRoute);
app.route("/", warmPathSettingsRoute);

app.onError((error, c) => {
  return c.json(
    {
      error: "Internal server error",
      details: error.message,
    },
    500
  );
});
