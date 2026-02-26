# Sprint 1 (Phase 0-1)

## Objective

Ship a working vertical slice for:

- network jobs sync
- persisted warm path ranking
- draft endpoint handoff contract

## Tasks

- [x] Add server runtime config and package manager setup
- [x] Wire SQLite adapter and run migrations on startup
- [x] Replace in-memory jobs cache with `jobs_cache` persistence
- [x] Add contact import and contact-driven signal derivation
- [x] Implement network jobs sync tests
- [x] Implement score unit tests for ask type and rationale
- [x] Connect basic Outreach page to `/api/warm-path/jobs` and `/api/warm-path/rank`

## Add-on Progress

- [x] Added LinkedIn CSV import panel to Outreach UI
- [x] Added Phase 5 second-degree scout schema + route skeleton
- [x] Replaced noop scout provider with LinkedIn `li_at` adapter
- [x] Added route-level API tests for scout and jobs sync endpoints
- [x] Added basic Scout UI panel to run and inspect scout runs
- [x] Hardened LinkedIn HTML parser and added parser-specific unit tests
- [x] Added scout stats endpoint and surfaced aggregate stats in UI
- [x] Added scout request guardrails and validation tests
- [x] Improved connector path scoring and confidence filtering

## Demo Criteria

- User can sync jobs from a selected advisor slug
- User can rank at least one mocked contact set
- User can generate a draft payload from a selected ranked contact
