# AGENTS.md
Guide for coding agents working in `warmpath`.

## Project Summary
WarmPath is a local-first job seeker copilot that helps users:
- discover jobs,
- rank warm connectors,
- generate outreach materials,
- track outreach workflow,
- learn from outcomes and tune ranking.

Monorepo stack:
- `apps/server`: Bun + Hono + SQLite API
- `apps/client`: React 19 + Vite + Tailwind v4 + shadcn/ui
- `packages/shared`: shared TypeScript contracts
- `docs`: roadmap, API references, release notes

## Repository Layout
```text
apps/server                  routes, DB repos, scoring, tests
apps/client                  UI pages/components and client API wrappers
packages/shared              request/response/event contracts
docs/                        plans and release/API docs
```

## Environment
- Runtime/package manager: Bun
- Server: `http://localhost:3001`
- Client: `http://localhost:5173`
- Default DB: `warmpath.db` (repo root)
- Override DB path with `WARMPATH_DB_PATH`

## Build / Dev / Test Commands
Run from repo root unless noted.

### Install deps
```bash
bun install
```

### Start dev servers
```bash
bun run dev:server
bun run dev:client
```

### Start single-origin mode (UI + API on one origin)
```bash
bun run dev:single-origin
```

### Typecheck
```bash
bun run typecheck:server
bun run typecheck:client
```

### Test (server)
```bash
bun run test:server
```

### Run a single test file
```bash
bun run --cwd apps/server test src/routes/warm-path-runs.route.test.ts
```

### Run a single test by name
```bash
bun run --cwd apps/server test src/routes/warm-path-runs.route.test.ts -t "generates distribution pack artifacts"
```

### Build client
```bash
bun run --cwd apps/client build
```

### Run demo flow
```bash
bun run demo
```

## Linting
- No dedicated lint script exists in root/workspace `package.json` files.
- Current quality gates: TypeScript checks + server tests + client build.

## Code Style and Conventions

### Language and module system
- TypeScript + ESM only.
- Prefer named exports for utilities when practical (follow local file patterns).

### Imports
- Use `import type` for type-only imports.
- Keep import order:
  1) external packages,
  2) internal modules,
  3) type imports (if separated).

### Formatting
- 2-space indentation
- double quotes
- semicolons
- trailing commas where formatter emits them

### Types and validation
- Avoid `any`; prefer `unknown` + narrowing.
- Validate untrusted input at route boundaries.
- Keep wire contracts in `packages/shared/src/contracts/*`.
- Update server and client together when contract shapes change.

### Naming
- `PascalCase`: components, interfaces, type aliases
- `camelCase`: functions, variables, params
- Keep file naming pattern consistent with neighboring files.

## Error Handling Patterns

### Server (Hono)
- Parse request JSON defensively: `await c.req.json().catch(() => ({}))`.
- Return `400` for invalid inputs with `{ error: string }`.
- Return `404` for missing resources.
- Wrap route logic in `try/catch` and return `{ error, details }` with `500` on unexpected failures.

### Client API wrappers
- Use shared response guard logic (`assertOk`) in `apps/client/src/lib/api.ts`.
- Surface server error payloads (`error`, `details`) in thrown errors.

## Data Layer Conventions
- Add schema changes in `apps/server/src/db/migrate.ts`.
- Put SQL access in `apps/server/src/db/repositories/*`.
- Keep route handlers thin; call repository helpers.
- For persistent features, include migration + repository + route + tests.

## Client Conventions
- `OutreachPage` owns orchestration state and step transitions.
- Prefer props-driven presentational components in `components/outreach/*`.
- Use shared UI primitives in `components/ui/*`.
- Use `cn()` from `@/lib/utils` for class composition.
- Keep UI consistent with existing Tailwind/shadcn patterns.

## Testing Conventions
- Test framework: `bun:test`.
- Route tests isolate DB using temp `WARMPATH_DB_PATH`.
- Use `resetDatabaseForTests()` in setup/teardown when touching DB.
- Cover success paths, validation failures, and guardrail edge cases.

## Agent Completion Checklist
Before handing off substantial changes:
1. `bun run typecheck:server`
2. `bun run typecheck:client`
3. `bun run test:server`
4. `bun run --cwd apps/client build`
5. Update docs when APIs/contracts/workflows change.

## Cursor / Copilot Rules
Checked for additional repo instructions in:
- `.cursor/rules/`
- `.cursorrules`
- `.github/copilot-instructions.md`

Current status: none of these files/directories exist in this repository.
