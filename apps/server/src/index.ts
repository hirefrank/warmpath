import { Hono } from "hono";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { getDatabase } from "./db";
import healthRoute from "./routes/health";
import warmPathContactsRoute from "./routes/warm-path-contacts";
import warmPathJobsRoute from "./routes/warm-path-jobs";
import warmPathRunsRoute from "./routes/warm-path-runs";
import warmPathScoutRoute from "./routes/warm-path-scout";
import warmPathSettingsRoute from "./routes/warm-path-settings";

const app = new Hono();
const clientDistDir = path.resolve(import.meta.dir, "../../client/dist");
const clientIndexPath = path.join(clientDistDir, "index.html");

app.route("/", healthRoute);
app.route("/", warmPathContactsRoute);
app.route("/", warmPathJobsRoute);
app.route("/", warmPathRunsRoute);
app.route("/", warmPathScoutRoute);
app.route("/", warmPathSettingsRoute);

app.get("*", (c) => {
  const requestPath = c.req.path;

  if (requestPath.startsWith("/api")) {
    return c.notFound();
  }

  if (!existsSync(clientIndexPath)) {
    return c.text(
      "Client bundle not found. Run `bun run --cwd apps/client build` for single-origin mode or use `bun run dev:client` in dual-process dev mode.",
      503
    );
  }

  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const resolvedPath = path.resolve(clientDistDir, relativePath);
  const insideClientDist =
    resolvedPath === clientDistDir || resolvedPath.startsWith(`${clientDistDir}${path.sep}`);

  if (!insideClientDist) {
    return c.notFound();
  }

  if (existsSync(resolvedPath) && statSync(resolvedPath).isFile()) {
    return new Response(Bun.file(resolvedPath));
  }

  if (path.extname(relativePath).length > 0) {
    return c.notFound();
  }

  return new Response(Bun.file(clientIndexPath));
});

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
