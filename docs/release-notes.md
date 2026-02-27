# WarmPath Release Notes

## Release 3 (Phase 10-14)

Date: 2026-02-26

### Highlights

- Added structured outreach briefs with ask-type objective, evidence, talking points, and tone support.
- Added multi-variant message packs (email + DM) with a follow-up plan.
- Added workflow tracking and reminder scheduling/update APIs with Draft-step controls.
- Added learning loop endpoints for feedback capture, summary insights, and auto-tuned ranking profiles.
- Added distribution packaging endpoint with export artifacts for machine and human workflows.

### API Additions

- `POST /api/warm-path/runs/:id/outreach-brief`
- `POST /api/warm-path/runs/:id/message-pack`
- `POST /api/warm-path/runs/:id/distribution-pack`
- `GET /api/warm-path/runs/:id/workflow`
- `POST /api/warm-path/runs/:id/workflow/track`
- `POST /api/warm-path/runs/:id/reminders`
- `PATCH /api/warm-path/runs/:id/reminders/:reminderId`
- `GET /api/warm-path/learning/summary`
- `POST /api/warm-path/learning/feedback`
- `POST /api/warm-path/learning/auto-tune`

### Data Model Changes

- Added workflow tables:
  - `outreach_workflow_entries`
  - `outreach_reminders`
- Added learning tables:
  - `learning_feedback`
  - `learning_weight_profiles`

### Client Experience Updates

- New Draft-step sections for:
  - structured brief review
  - message variant review and copy actions
  - workflow timeline and reminders
  - learning loop controls and profile visibility
  - distribution artifact preview and copy actions

### Validation

- `bun run typecheck:server`
- `bun run typecheck:client`
- `bun run test:server`
- `bun run --cwd apps/client build`

All checks passed on this release cut.
