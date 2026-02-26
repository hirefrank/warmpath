# Phase 0-4 Build Tickets

This document maps the first release to concrete files and APIs.

## Proposed Monorepo File Map

- `apps/server/src/index.ts`
- `apps/server/src/db/index.ts`
- `apps/server/src/db/migrate.ts`
- `apps/server/src/db/repositories/contacts.ts`
- `apps/server/src/db/repositories/jobs-cache.ts`
- `apps/server/src/db/repositories/warm-path-runs.ts`
- `apps/server/src/lib/events.ts`
- `apps/server/src/lib/job-sources/network-jobs.ts`
- `apps/server/src/lib/job-sources/all-jobs.ts`
- `apps/server/src/lib/normalize/company.ts`
- `apps/server/src/lib/normalize/title.ts`
- `apps/server/src/lib/scoring/ranker.ts`
- `apps/server/src/lib/scoring/weights.ts`
- `apps/server/src/lib/scoring/ask-type.ts`
- `apps/server/src/routes/warm-path-jobs.ts`
- `apps/server/src/routes/warm-path-runs.ts`
- `apps/server/src/routes/warm-path-contacts.ts`
- `apps/client/src/pages/OutreachPage.tsx`
- `apps/client/src/components/outreach/JobPicker.tsx`
- `apps/client/src/components/outreach/RankedPathsList.tsx`
- `apps/client/src/components/outreach/ScoreBreakdown.tsx`
- `apps/client/src/components/outreach/IntroDraftPanel.tsx`
- `packages/shared/src/contracts/job.ts`
- `packages/shared/src/contracts/warm-path.ts`

## Phase 0 Tickets

### Ticket P0-1: Event Schema

- Files:
  - `apps/server/src/lib/events.ts`
  - `packages/shared/src/contracts/warm-path.ts`
- Output:
  - Type-safe event payloads for rank, draft, sent, replied, intro_accepted

### Ticket P0-2: KPI Queries

- Files:
  - `docs/metrics-sql.md`
  - `apps/server/src/db/migrate.ts`
- Output:
  - SQL snippets for KPI views and aggregates

### Ticket P0-3: Ranking Experiment Flags

- Files:
  - `apps/server/src/lib/scoring/weights.ts`
  - `apps/server/src/routes/warm-path-runs.ts`
- Output:
  - Weight profile selection by query/header flag

## Phase 1 Tickets

### Ticket P1-1: Normalized Job Contract

- Files:
  - `packages/shared/src/contracts/job.ts`
- Output:
  - `NormalizedJob` and source metadata contract

### Ticket P1-2: Network Jobs Adapter

- Files:
  - `apps/server/src/lib/job-sources/network-jobs.ts`
- Output:
  - Fetch `manifest` + category files and emit `NormalizedJob[]`

### Ticket P1-3: Company and Title Normalizers

- Files:
  - `apps/server/src/lib/normalize/company.ts`
  - `apps/server/src/lib/normalize/title.ts`
- Output:
  - Normalized company and role tokens for matching/scoring

## Phase 2 Tickets

### Ticket P2-1: DB Migration

- Files:
  - `apps/server/src/db/migrate.ts`
- Output tables:
  - `jobs_cache`
  - `warm_path_runs`
  - `warm_path_results`

### Ticket P2-2: Jobs Sync/List API

- Files:
  - `apps/server/src/routes/warm-path-jobs.ts`
  - `apps/server/src/index.ts`
- Endpoints:
  - `POST /api/warm-path/jobs/sync`
  - `GET /api/warm-path/jobs`

### Ticket P2-3: Rank + History API

- Files:
  - `apps/server/src/routes/warm-path-runs.ts`
  - `apps/server/src/index.ts`
- Endpoints:
  - `POST /api/warm-path/rank`
  - `GET /api/warm-path/runs/:id`

### Ticket P2-4: Intro Draft Handoff API

- Files:
  - `apps/server/src/routes/warm-path-runs.ts`
- Endpoint:
  - `POST /api/warm-path/runs/:id/intro-draft`

## Phase 3 Tickets

### Ticket P3-1: Scoring Weights and Components

- Files:
  - `apps/server/src/lib/scoring/weights.ts`
  - `apps/server/src/lib/scoring/ranker.ts`
  - `apps/server/src/lib/scoring/ask-type.ts`
- Output:
  - `scoreWarmPath(job, contact, seekerContext)`

### Ticket P3-2: Rationale Builder

- Files:
  - `apps/server/src/lib/scoring/ranker.ts`
- Output:
  - One-line rationale attached to each ranked result

### Ticket P3-3: Thresholds and Fallbacks

- Files:
  - `apps/server/src/routes/warm-path-runs.ts`
- Output:
  - fallback suggestions when no high-confidence path exists

## Phase 4 Tickets

### Ticket P4-1: Outreach Page Shell

- Files:
  - `apps/client/src/pages/OutreachPage.tsx`
- Output:
  - job picker + rank button + results panel layout

### Ticket P4-2: Job Picker + Filters

- Files:
  - `apps/client/src/components/outreach/JobPicker.tsx`
- Output:
  - filter by company/category/location/source lane

### Ticket P4-3: Ranked Paths UI

- Files:
  - `apps/client/src/components/outreach/RankedPathsList.tsx`
  - `apps/client/src/components/outreach/ScoreBreakdown.tsx`
- Output:
  - top contacts, score, ask type, rationale, score breakdown

### Ticket P4-4: Intro Draft Panel

- Files:
  - `apps/client/src/components/outreach/IntroDraftPanel.tsx`
- Output:
  - one-click draft generation and copy-ready output

## API Contract Draft

### `POST /api/warm-path/jobs/sync`

Request:

```json
{
  "advisor_slug": "hirefrank",
  "category": "product",
  "location": "nyc",
  "seniority": "senior",
  "source": "network"
}
```

Response:

```json
{
  "synced": 124,
  "source": "network",
  "cached_at": "2026-02-26T20:00:00.000Z"
}
```

### `GET /api/warm-path/jobs`

Query params:

- `advisor_slug`
- `company`
- `category`
- `location`
- `source` (`network` | `all`)

### `POST /api/warm-path/contacts/import`

Request (JSON contacts):

```json
{
  "contacts": [
    {
      "name": "Jane Doe",
      "current_title": "Senior Recruiter",
      "current_company": "Stripe",
      "connected_on": "2024-03-01"
    }
  ]
}
```

Request (LinkedIn CSV):

```json
{
  "csv": "First Name,Last Name,Company,Position,Connected On\nJane,Doe,Stripe,Senior Recruiter,2024-03-01"
}
```

### `GET /api/warm-path/contacts`

Query params:

- `company` (optional substring filter)
- `limit` (default 200)

### `POST /api/warm-path/rank`

Request:

```json
{
  "advisor_slug": "hirefrank",
  "job_cache_id": "hirefrank:12345",
  "seeker_name": "Jon Goldmann",
  "seeker_linkedin_url": "https://linkedin.com/in/jon"
}
```

Response:

```json
{
  "run_id": "b4a9d43b-6da1-4d0f-b344-1fd2b971f8af",
  "top_paths": [
    {
      "colleague_id": "col-123",
      "name": "Jane Doe",
      "total_score": 87.5,
      "recommended_ask": "referral",
      "rationale": "Current recruiter at target company with strong role alignment."
    }
  ]
}
```

### `POST /api/warm-path/runs/:id/intro-draft`

Request:

```json
{
  "colleague_id": "col-123",
  "resume_text": "...",
  "extra_context": "targeting product leadership roles"
}
```

Response:

```json
{
  "subject": "Quick favor: intro to team at Stripe",
  "forwardable_email": "...",
  "short_dm": "...",
  "follow_up_sequence": ["day_3", "day_7", "day_14"]
}
```

## Phase 5 Scaffold (Started)

Files added for second-degree scout foundation:

- `packages/shared/src/contracts/scout.ts`
- `apps/server/src/db/repositories/second-degree-scout.ts`
- `apps/server/src/lib/scout/second-degree-scout.ts`
- `apps/server/src/routes/warm-path-scout.ts`

Schema added:

- `second_degree_scout_runs`
- `second_degree_targets`
- `connector_paths`

Scaffold endpoints:

- `POST /api/warm-path/scout/run`
- `GET /api/warm-path/scout/runs`
- `GET /api/warm-path/scout/runs/:id`
- `GET /api/warm-path/scout/stats`
