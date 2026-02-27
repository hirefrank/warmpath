# WarmPath

Find the best warm path into a job, then execute outreach with structure.

![WarmPath screenshot](docs/screenshot.png)

## The problem

Job search outreach is usually messy:

- you find a role,
- you guess who to contact,
- you send a message,
- then follow-ups slip through the cracks.

Most people do this with scattered notes, memory, and luck.

WarmPath turns that into a repeatable workflow.

## What WarmPath does

WarmPath helps you answer three practical questions fast:

1. Which job should I prioritize first?
2. Who is the best person in my network to ask for context, intro, or referral?
3. What should I send next, and when should I follow up?

It runs locally by default and keeps your working data in local SQLite.

## Features

- Import your LinkedIn connections CSV
- Sync jobs and pick target roles
- Rank warm paths with transparent scoring
- Generate structured outreach briefs + message packs
- Track outreach status and reminders
- Learn from outcomes and auto-tune ranking profiles
- Export distribution artifacts (JSON bundle, markdown playbook, CRM note)

## Quick start

### Prerequisites

- [Bun](https://bun.sh)

### Setup

```bash
# 1) install dependencies
bun install

# 2) start WarmPath (single-origin UI + API)
bun run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Configuration (non-technical path)

You do **not** need to edit `.env` for normal use.

Use the in-app **Settings** step:

1. Set your profile slug (used for job sync/ranking defaults)
2. Set default job category
3. Optionally paste your LinkedIn `li_at` session cookie
4. Click **Save Settings**

That is enough for most users.

## Getting your LinkedIn `li_at` cookie

If you want live LinkedIn-powered scouting:

1. Open [linkedin.com](https://www.linkedin.com) and sign in
2. Open DevTools (`F12` or `Cmd+Option+I`)
3. Go to **Application** -> **Cookies** -> `linkedin.com`
4. Find cookie name `li_at`
5. Copy its full value and paste it in WarmPath Settings

Treat this cookie like a password.

## Usage

Typical flow:

1. **Settings**: save defaults and optional LinkedIn cookie
2. **Contacts**: import LinkedIn CSV
3. **Jobs**: sync jobs, select one
4. **Rank**: score warm connectors
5. **Draft**: generate brief/message pack/distribution assets
6. **Track**: mark sent/replied, schedule reminders
7. **Learn**: record outcomes and improve recommendations

## How it works

WarmPath pipeline:

`discover -> rank -> draft -> track -> learn`

At runtime:

- Browser UI calls `/api/*`
- Hono server handles routing + scoring + generation
- SQLite stores jobs, contacts, runs, outcomes, settings
- In single-origin mode, server also serves built frontend assets

## On LinkedIn automation

WarmPath uses your own authenticated session (if you provide `li_at`) for scout-related discovery.

- It does not require fake accounts.
- It does not bypass access controls.
- It automates actions you could perform manually.

LinkedIn Terms are broad and may restrict automation. Use responsibly:

- keep reasonable rate limits,
- use for personal workflows,
- avoid redistributing data,
- understand you are responsible for your use.

## Security and privacy

- App data is local-first in SQLite.
- Sensitive values (like LinkedIn session cookie) are stored locally.
- Guardrails sanitize risky context in draft inputs.
- If your session cookie is compromised, revoke it in LinkedIn settings.

## Project structure

```text
warmpath/
├── apps/
│   ├── server/           # Hono API, repositories, scoring, route tests
│   └── client/           # React UI, sidebar workflow, API wrappers
├── packages/
│   └── shared/           # Cross-app TypeScript contracts
└── docs/                 # Plan, API reference, release notes
```

---

<details>
<summary><strong>Appendix: Developer Reference</strong></summary>

### Dev modes

```bash
# single-origin (default)
bun run dev

# explicit single-origin alias
bun run dev:single-origin

# dual-process dev (frontend HMR)
bun run dev:server
bun run dev:client
```

### Quality checks

```bash
# type checks
bun run typecheck:server
bun run typecheck:client

# server tests
bun run test:server

# run one server test file
bun run --cwd apps/server test src/routes/warm-path-runs.route.test.ts

# run one test by name
bun run --cwd apps/server test src/routes/warm-path-runs.route.test.ts -t "generates distribution pack artifacts"

# build client
bun run --cwd apps/client build
```

### API overview

Core:

- `GET /api/warm-path/settings`
- `PUT /api/warm-path/settings`
- `POST /api/warm-path/rank`
- `GET /api/warm-path/runs/:id`
- `POST /api/warm-path/runs/:id/outreach-brief`
- `POST /api/warm-path/runs/:id/message-pack`
- `POST /api/warm-path/runs/:id/distribution-pack`
- `POST /api/warm-path/runs/:id/intro-draft`

Workflow + reminders:

- `GET /api/warm-path/runs/:id/workflow`
- `POST /api/warm-path/runs/:id/workflow/track`
- `POST /api/warm-path/runs/:id/reminders`
- `PATCH /api/warm-path/runs/:id/reminders/:reminderId`

Learning:

- `GET /api/warm-path/learning/summary`
- `POST /api/warm-path/learning/feedback`
- `POST /api/warm-path/learning/auto-tune`

Scout + jobs + contacts:

- `POST /api/warm-path/jobs/sync`
- `GET /api/warm-path/jobs`
- `POST /api/warm-path/contacts/import`
- `GET /api/warm-path/contacts`
- `POST /api/warm-path/scout/run`
- `GET /api/warm-path/scout/runs`
- `GET /api/warm-path/scout/runs/:id`
- `GET /api/warm-path/scout/stats`

### Advanced environment overrides (optional)

Most users can ignore these and use Settings UI.

- `WARMPATH_DB_PATH` (default: `warmpath.db`)
- `LINKEDIN_LI_AT`
- `LINKEDIN_RATE_LIMIT_MS` (default `1200`)
- `LINKEDIN_REQUEST_TIMEOUT_MS` (default `15000`)
- `SCOUT_MIN_TARGET_CONFIDENCE` (default `0.45`)
- `SCOUT_STATIC_TARGETS_JSON`
- `SCOUT_PROVIDER_ORDER` (default `linkedin_li_at,static_seed`)

Scout v2 weight overrides:

- `SCOUT_V2_WEIGHT_COMPANY_ALIGNMENT`
- `SCOUT_V2_WEIGHT_ROLE_ALIGNMENT`
- `SCOUT_V2_WEIGHT_RELATIONSHIP`
- `SCOUT_V2_WEIGHT_CONNECTOR_INFLUENCE`
- `SCOUT_V2_WEIGHT_TARGET_CONFIDENCE`
- `SCOUT_V2_WEIGHT_ASK_FIT`
- `SCOUT_V2_WEIGHT_SAFETY`

</details>

## License

MIT
