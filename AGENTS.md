# CLAUDE.md

Guidelines for coding agents working in WarmPath.

## Project Overview

WarmPath is a local-first job seeker copilot for finding warm outreach paths. Monorepo with Bun workspaces.

## Repository Structure

```
apps/server      — Bun + Hono + SQLite API (port 3001)
apps/client      — React 19 + Vite + Tailwind v4 + shadcn/ui (port 5173)
packages/shared  — Shared TypeScript contracts
docs/            — Roadmap, ticket map, architecture notes
```

## Build / Dev / Test Commands

```bash
bun install                          # install all workspace deps
bun run dev:server                   # Hono API on :3001
bun run dev:client                   # Vite dev server on :5173
bun run typecheck:client             # client type check
bun run typecheck:server             # server type check
bun run test:server                  # server tests
bun run --cwd apps/client build      # production build
bun run demo                         # full demo flow
```

## Code Style

- ESM throughout, `"type": "module"` in all package.json files
- Import order: external → internal → type imports
- Use `import type` for type-only imports
- 2-space indentation, double quotes, semicolons
- `PascalCase` for types/interfaces/components, `camelCase` for functions/variables
- Avoid `any`; use `unknown` + narrowing
- Validate external inputs at API boundaries

## Path Aliases (Client)

- `@/*` → `apps/client/src/*`
- `@warmpath/shared/*` → `packages/shared/src/*`

Configured in both `apps/client/tsconfig.json` and `apps/client/vite.config.ts`.

## Client Design System

### Stack

- **Bundler:** Vite 6 with `@vitejs/plugin-react`
- **CSS:** Tailwind CSS v4 (CSS-first — no `tailwind.config.js`, config lives in `src/index.css` `@theme` block)
- **Components:** shadcn/ui (new-york style, no RSC)
- **Icons:** lucide-react
- **Utilities:** `class-variance-authority`, `clsx`, `tailwind-merge`

### Theme Tokens

Defined in `apps/client/src/index.css` via oklch CSS variables:

- `--color-primary` / `--color-primary-foreground` — buttons, active states
- `--color-muted` / `--color-muted-foreground` — secondary text, subtle backgrounds
- `--color-card` / `--color-card-foreground` — card surfaces
- `--color-sidebar-*` — sidebar-specific palette (background, foreground, accent, border)
- `--color-border`, `--color-input`, `--color-ring` — form element chrome
- `--color-destructive` — error states and alerts
- `--radius` — global border radius (`0.625rem`)

Neutral base color. No dark mode yet.

### UI Components (`src/components/ui/`)

Lightweight shadcn/ui ports. Only external Radix dependency is `@radix-ui/react-slot` (Button `asChild`):

| Component | Notes |
|---|---|
| `button` | CVA variants: default, destructive, outline, secondary, ghost, link. Sizes: default, sm, lg, icon |
| `card` | Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| `input` | Styled native `<input>` |
| `textarea` | Styled native `<textarea>` |
| `select` | Native `<select>` with lucide ChevronDown overlay |
| `badge` | CVA variants: default, secondary, destructive, outline |
| `label` | Styled native `<label>` |
| `separator` | Horizontal/vertical divider |
| `scroll-area` | Simple overflow container (no Radix ScrollArea) |

### Layout Architecture

```
AppLayout (flex h-screen)
├── AppSidebar (w-60, fixed left, 5 workflow steps)
│   └── Scout → Contacts → Jobs → Rank → Draft
└── ScrollArea (flex-1, scrollable)
    └── main (max-w-3xl, centered)
        └── active step panel
```

- `OutreachPage` owns all state and passes handlers as props
- `activeStep` state controls which panel renders
- Sidebar badges show live counts (contacts, jobs, paths, draft status)

### Component Conventions

- All outreach components receive props only — no internal data fetching
- Use `cn()` from `@/lib/utils` for conditional class merging
- Wrap panel sections in `Card` components
- Form fields: `Label` + `Input`/`Textarea`/`Select`
- Actions: shadcn `Button` with appropriate variant
- Counts and statuses: `Badge` components
- Progress bars: colored `div` inside `bg-muted` track with percentage width

### API Proxy

Vite dev server proxies `/api` → `http://localhost:3001`. Client uses relative URLs (`API_BASE = ""`). No CORS needed in dev.

## Server Notes

- Database file defaults to `warmpath.db` in project root
- Override with `WARMPATH_DB_PATH` env var
- `LINKEDIN_LI_AT` env var for 2nd-degree scout LinkedIn integration
