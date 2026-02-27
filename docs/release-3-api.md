# Release 3 API Surface (Phase 10-14)

This document summarizes the implemented API surface for Release 3:

- Phase 10: structured outreach brief generation
- Phase 11: message pack generation (email + DM + follow-up)
- Phase 12: workflow tracking and reminders
- Phase 13: learning loop and auto-tuned scoring profiles
- Phase 14: packaging and distribution artifacts

## Brief + Message Generation

## App Settings

### `GET /api/warm-path/settings`

Returns persisted user-facing app settings used for scout/ranking defaults (with env/default fallbacks).

### `PUT /api/warm-path/settings`

Updates persisted app settings so non-technical users can configure behavior from the UI instead of `.env` files.

### `POST /api/warm-path/runs/:id/outreach-brief`

Generate a structured brief for a selected ranked colleague.

Request body:

```json
{
  "colleague_id": "col-123",
  "extra_context": "optional context",
  "tone": "warm"
}
```

### `POST /api/warm-path/runs/:id/message-pack`

Generate channel variants from the structured brief.

Artifacts include:

- email variants
- DM variants
- follow-up plan

### `POST /api/warm-path/runs/:id/intro-draft`

Generate the full intro draft payload. Response includes:

- forwardable email
- short DM
- follow-up sequence
- embedded brief and message pack

## Workflow + Reminders

### `GET /api/warm-path/runs/:id/workflow?colleague_id=...`

Returns timeline entries, reminder list, and latest status.

### `POST /api/warm-path/runs/:id/workflow/track`

Track status progression (`sent`, `replied`, `intro_accepted`, etc.).

### `POST /api/warm-path/runs/:id/reminders`

Schedule a reminder by explicit `due_at` or `offset_days`.

### `PATCH /api/warm-path/runs/:id/reminders/:reminderId`

Update reminder status (`pending`, `completed`, `cancelled`).

## Learning Loop

### `GET /api/warm-path/learning/summary`

Returns active scoring profile, feedback totals, and recent feedback.

### `POST /api/warm-path/learning/feedback`

Record manual learning outcome for a run + colleague.

### `POST /api/warm-path/learning/auto-tune`

Creates and activates an auto-tuned scoring profile from collected outcomes.

## Packaging + Distribution

### `POST /api/warm-path/runs/:id/distribution-pack`

Generates export-ready packaging artifacts:

- `json_bundle` (machine-readable)
- `markdown_playbook` (human-readable execution plan)
- `crm_note` (compact note for external systems)
