import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { app } from "../../server/src/app";
import { getDatabase } from "../../server/src/db";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

/**
 * Start the Hono server under Node.js with static file serving for the
 * pre-built React client.
 */
export function startServer(clientDistDir: string, port: number): void {
  getDatabase();

  const clientIndexPath = path.join(clientDistDir, "index.html");

  app.get("*", (c) => {
    const requestPath = c.req.path;

    if (requestPath.startsWith("/api")) {
      return c.notFound();
    }

    if (!existsSync(clientIndexPath)) {
      return c.text("Client bundle not found.", 503);
    }

    const relativePath =
      requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
    const resolvedPath = path.resolve(clientDistDir, relativePath);
    const insideClientDist =
      resolvedPath === clientDistDir ||
      resolvedPath.startsWith(`${clientDistDir}${path.sep}`);

    if (!insideClientDist) {
      return c.notFound();
    }

    if (existsSync(resolvedPath) && statSync(resolvedPath).isFile()) {
      const content = readFileSync(resolvedPath);
      const ext = path.extname(resolvedPath).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      return new Response(content, {
        headers: { "Content-Type": contentType },
      });
    }

    if (path.extname(relativePath).length > 0) {
      return c.notFound();
    }

    const indexContent = readFileSync(clientIndexPath);
    return new Response(indexContent, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

  serve({ fetch: app.fetch, port });
  console.log(`WarmPath server running at http://localhost:${port}`);
}
