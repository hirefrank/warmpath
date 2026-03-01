import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { getDatabase } from "./db";
import { app } from "./app";
export { app };

const clientDistDir = path.resolve(import.meta.dir, "../../client/dist");
const clientIndexPath = path.join(clientDistDir, "index.html");

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

if (import.meta.main) {
  getDatabase();
  const port = Number(Bun.env.PORT ?? 3001);
  Bun.serve({ port, fetch: app.fetch });
  console.log(`WarmPath server running at http://localhost:${port}`);
}
