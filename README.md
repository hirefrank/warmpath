# WarmPath

Local-first job seeker copilot for finding the best warm outreach path.

## Product Lanes

- Reachable Now: jobs where you already have direct network coverage.
- Build a Path: jobs where a viable connector path can be created.
- Execute: outreach packs (intro email, DM, follow-up sequence).

## Core Flow

1. Discover jobs
2. Rank warm paths
3. Generate outreach pack
4. Track outcomes and improve ranking

## Tech Direction

- App model: local-first desktop/web app on `localhost`
- Server: Bun + Hono + SQLite (port 3001)
- Client: React 19 + Vite + Tailwind CSS v4 + shadcn/ui (port 5173)
- Integrations: LinkedIn session (`li_at`), jobs feed APIs, optional LLM

## Repository Layout

- `apps/server`: API, data pipeline, scoring engine
- `apps/client`: UI for discovery, ranking, and outreach
- `packages/shared`: shared contracts and types
- `docs`: roadmap, ticket map, and architecture notes

## Quick Start

1. Install dependencies:

```bash
bun install
```

2. Run server:

```bash
bun run dev:server
```

3. Run client:

```bash
bun run dev:client
```

4. Open `http://localhost:5173` — sidebar with 5 workflow steps (Scout, Contacts, Jobs, Rank, Draft).

5. Check API health:

```bash
curl -s http://localhost:3001/api/health
```

6. Run server tests:

```bash
bun run --cwd apps/server test
```

7. Run the full demo flow in one command:

```bash
bun run demo
```

## Client Design System

The client uses a sidebar-driven workflow layout built with:

- **Vite 6** — dev server with API proxy (`/api` → `:3001`), React plugin, path aliases
- **Tailwind CSS v4** — CSS-first config via `@theme` block in `src/index.css` (no `tailwind.config.js`)
- **shadcn/ui** — new-york style components (Button, Card, Input, Textarea, Select, Badge, Label, Separator, ScrollArea)
- **lucide-react** — icons

### Layout

```
AppLayout
├── AppSidebar (w-60) — Scout → Contacts → Jobs → Rank → Draft
└── ScrollArea — max-w-3xl centered content area
```

Each sidebar step renders one panel. `OutreachPage` owns all state and routes between steps via `activeStep`.

### Theme

Neutral oklch color tokens defined as CSS variables — `primary`, `muted`, `card`, `sidebar-*`, `border`, `destructive`, `radius`. No dark mode yet.

### Path Aliases

| Alias | Resolves to |
|---|---|
| `@/*` | `apps/client/src/*` |
| `@warmpath/shared/*` | `packages/shared/src/*` |

## Current API Slice

- `POST /api/warm-path/jobs/sync`
  - Syncs jobs from `jobs.hirefrank.com` into local SQLite cache.
- `GET /api/warm-path/jobs`
  - Lists cached jobs by advisor/company/category/location/source filters.
- `POST /api/warm-path/contacts/import`
  - Imports contacts from either `contacts[]` JSON payload or LinkedIn CSV string.
- `GET /api/warm-path/contacts`
  - Lists imported contacts, optionally filtered by company.
- `POST /api/warm-path/rank`
  - Ranks warm paths from provided `contact_signals`, or auto-derives from imported contacts + selected job.
- `GET /api/warm-path/runs/:id`
  - Returns persisted run and ranked paths.
- `POST /api/warm-path/runs/:id/intro-draft`
  - Generates an outreach draft from a ranked path.
- `POST /api/warm-path/scout/run`
  - Starts a Phase 5 second-degree scout run (currently scaffolded, provider-ready).
- `GET /api/warm-path/scout/runs`
  - Lists recent second-degree scout runs.
- `GET /api/warm-path/scout/runs/:id`
  - Returns one scout run with targets and connector paths.
- `GET /api/warm-path/scout/stats`
  - Returns aggregate scout run metrics by status and source.

## Notes

- Database file defaults to `warmpath.db` in project root.
- Override DB path with `WARMPATH_DB_PATH`.
- Ranking and run events are persisted for KPI tracking.

## LinkedIn Scout Config

- `LINKEDIN_LI_AT`: LinkedIn session cookie used for 2nd-degree people search.
- `LINKEDIN_RATE_LIMIT_MS` (optional): minimum delay between LinkedIn requests (default `1200`).
- `LINKEDIN_REQUEST_TIMEOUT_MS` (optional): LinkedIn request timeout (default `15000`).
- `SCOUT_MIN_TARGET_CONFIDENCE` (optional): minimum confidence threshold for saving discovered targets (default `0.45`).
- `SCOUT_STATIC_TARGETS_JSON` (optional): JSON array of fallback targets for local/non-LinkedIn scouting.
- `SCOUT_PROVIDER_ORDER` (optional): comma-separated provider order, default `linkedin_li_at,static_seed`.

Without a valid `LINKEDIN_LI_AT`, scout runs still work with `seed_targets` but will return `needs_adapter` for live discovery.

Scout request guardrails:

- `target_company` required, 2-120 chars
- `limit` must be 1-100
- `seed_targets` max 100 entries

## Example Flow

1. Sync jobs:

```bash
curl -s -X POST http://localhost:3001/api/warm-path/jobs/sync \
  -H 'content-type: application/json' \
  -d '{"advisor_slug":"hirefrank","category":"product","source":"network"}'
```

2. Import contacts:

```bash
curl -s -X POST http://localhost:3001/api/warm-path/contacts/import \
  -H 'content-type: application/json' \
  -d '{"contacts":[{"name":"Jamie Recruiter","current_title":"Senior Recruiter","current_company":"Capital One"}]}'
```

3. Rank paths for a cached job:

```bash
curl -s -X POST http://localhost:3001/api/warm-path/rank \
  -H 'content-type: application/json' \
  -d '{"advisor_slug":"hirefrank","job_cache_id":"hirefrank:network:1138842"}'
```

4. Start a second-degree scout run (seed targets for now):

```bash
curl -s -X POST http://localhost:3001/api/warm-path/scout/run \
  -H 'content-type: application/json' \
  -d '{
    "target_company":"Acme",
    "target_function":"product",
    "seed_targets":[
      {"full_name":"Taylor Candidate","current_title":"Senior Product Manager","current_company":"Acme"}
    ]
  }'
```
