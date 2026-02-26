# WarmPath Plan

## Vision

Build a local-first product that helps job seekers answer three questions quickly:

1. Where should I apply first?
2. Who is the best person to ask for context, intro, or referral?
3. What exact outreach should I send next?

This plan combines three feature tracks:

- Warm Path Ranker (foundation)
- 2nd-Degree Scout (path expansion)
- Outreach Copilot Packs (execution)

## Strategy

- Keep `Reachable Now` as the default experience (network-first moat).
- Add `Build a Path` for broader jobs only when a viable warm path exists.
- Keep cold jobs available, but deprioritized.
- Reuse one pipeline: `discover -> rank -> draft -> track -> learn`.

## Release Roadmap

### Release 1 - Warm Path Foundation

- Phase 0: success metrics and event schema
- Phase 1: data contracts and source adapters
- Phase 2: DB migrations and ranking APIs
- Phase 3: scoring engine v1
- Phase 4: outreach UI v1

### Release 2 - 2nd-Degree Scout

- Phase 5: authenticated LinkedIn scout harvester
- Phase 6: mutual connector path mapping
- Phase 7: scoring engine v2 for indirect paths
- Phase 8: Build a Path lane
- Phase 9: trust and safety guardrails

### Release 3 - Outreach Copilot Packs

- Phase 10: structured outreach brief generator
- Phase 11: email + DM + follow-up generation
- Phase 12: workflow tracking and reminders
- Phase 13: learning loop and auto-tuning
- Phase 14: packaging and distribution modes

## Detailed Phase 0-4 Build Plan

## Current Status

- Completed:
  - Monorepo + local server runtime scaffold
  - SQLite migrations and persistence for jobs/runs/results/events
  - Network jobs sync adapter (`jobs.hirefrank.com`)
  - Network jobs sync automated tests (mock fetch + fixtures)
  - Contact import endpoints and contact-derived ranking signals
  - Outreach page wiring for contacts import, job sync, rank, and draft flow
  - Ranking + draft generation endpoints with smoke-tested flow
  - Scoring unit tests
  - Phase 5 schema and second-degree scout route/service skeleton
  - LinkedIn `li_at` second-degree scout adapter and env-based provider wiring
  - Route-level API tests for jobs sync and scout run flows
  - Basic Scout UI panel for running and inspecting scout results
  - Hardened LinkedIn HTML parser with parser-focused unit tests
  - Scout stats endpoint and UI summary metrics
  - Scout request guardrails and target confidence filtering
  - Improved connector path scoring (multi-signal ranking, richer rationale)
- In progress:
  - Expand provider strategies beyond HTML scraping (multi-adapter chain)

### Phase 0 - Success Metrics

Goal: define measurable outcomes before building features.

Deliverables:

- Event taxonomy and payload schema
- KPI dashboard query definitions
- Experiment flags for ranking variants

Primary KPIs:

- `rank_to_draft_rate`
- `draft_to_sent_rate`
- `reply_rate`
- `intro_acceptance_rate`
- `time_to_first_outreach_minutes`

### Phase 1 - Data Contracts

Goal: normalize and merge job data into a single contract independent of source.

Sources:

- Network-first jobs feed (`jobs.hirefrank.com`)
- Future all-jobs source adapter

Output contract:

- `NormalizedJob`: id, source, title, company, companyDomain, category, department, location, url, postedAt, firstSeen, lastSeen

### Phase 2 - Persistence + APIs

Goal: add storage and endpoints for sync, list, rank, and history.

Core tables:

- `jobs_cache`
- `warm_path_runs`
- `warm_path_results`

Core endpoints:

- `POST /api/warm-path/jobs/sync`
- `GET /api/warm-path/jobs`
- `POST /api/warm-path/rank`
- `GET /api/warm-path/runs/:id`
- `POST /api/warm-path/runs/:id/intro-draft`

### Phase 3 - Scoring Engine v1

Goal: rank best 1st-degree contact paths with transparent rationale.

Scoring dimensions (0-100):

- Company affinity (35)
- Role relevance (25)
- Relationship strength (20)
- Shared context overlap (15)
- Confidence (5)

Per-result output:

- `total_score`
- `recommended_ask`: context | intro | referral
- short rationale sentence

### Phase 4 - Outreach UI v1

Goal: move from selected job to sendable draft in minimal clicks.

UI flow:

1. Select job
2. Rank warm paths
3. Review top contacts and rationale
4. Generate outreach pack

Acceptance criteria:

- Warm cache rank latency under 3 seconds
- Every ranked result includes rationale
- Job -> draft in two clicks or fewer

## Engineering Map (Files + Endpoints)

See `docs/phase-0-4-build-tickets.md` for exact files and ticket-level scope.
