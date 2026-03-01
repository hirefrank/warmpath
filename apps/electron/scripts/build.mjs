/**
 * Bundle the Electron main + preload processes with esbuild.
 *
 * Key concern: the server code imports from "bun:sqlite". We alias that to our
 * compatibility shim (sqlite-compat.ts) which wraps better-sqlite3 to expose
 * the same API surface.
 */

import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "../src");

/** esbuild plugin that redirects "bun:sqlite" → our better-sqlite3 shim. */
const bunSqliteCompat = {
  name: "bun-sqlite-compat",
  setup(build) {
    build.onResolve({ filter: /^bun:sqlite$/ }, () => ({
      path: path.resolve(srcDir, "sqlite-compat.ts"),
    }));
  },
};

const shared = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outdir: path.resolve(__dirname, "../dist"),
  external: ["electron", "better-sqlite3"],
  plugins: [bunSqliteCompat],
  sourcemap: true,
  logLevel: "info",
};

// Main process
await build({
  ...shared,
  entryPoints: [path.resolve(srcDir, "main.ts")],
});

// Preload script
await build({
  ...shared,
  entryPoints: [path.resolve(srcDir, "preload.ts")],
});

console.log("Electron build complete.");
