# MatOS — Product Brief

**Product:** MatOS  
**Owner:** Macnet Junior  
**Phase:** 3 — workflows, review gates, dry-run engine, channel stubs  
**Accent:** Citron Volt `#D6F31F` (hover `#E8FF5A`, pressed `#B8D110`)

## Intent

Ship a production-minded monorepo that runs locally, matches the Citron Volt dark UI, and models the agency as an interactive company map backed by a real database — not a chatbot skin.

## Phase 0 (done)

Next.js shell, Auth.js credentials login, React Flow map chrome, Citron design system, CI.

## Phase 1 (done)

1. **SQLite via Prisma** (`packages/db`) — migrations + seed for 7 departments and commercial-plan skills (`hook-lab`, `short-script`, `content-calendar`, `etsy-listing-lab`, …).
2. **Map reads from DB** — server load on `/map` + `GET /api/map`.
3. **Auto-arrange** — deterministic layout, persists positions (`POST /api/layout`).
4. **Search** — keyboard-accessible filter in map chrome (⌘K / Ctrl+K).
5. **Owner-gated CRUD** — create/edit department & skill with Zod; activity events appended.
6. **Expand/collapse** departments; expanded state persisted for owner.
7. **Stats row** — dept count, authored / planned / missing from DB.
8. Tests for validation + DB payload; CI migrates + seeds before checks.
9. ADR: `docs/adr/001-sqlite-prisma.md`.

## Phase 2 (done)

1. **Knowledge corpus** — markdown under `knowledge/` with skill→file links in SQLite.
2. **Knowledge reader** — `GET /api/knowledge`; Knowledge page + detail Knowledge tab via **react-markdown**.
3. **Instructions markdown** — skill instructions tab renders markdown the same way.
4. **Evidence links** — URL + label stored in `evidenceJson`; owner add/remove in Evidence tab.
5. **Status reconcile** — derived Authored/Planned/Missing synced back to `skills.status`.
6. **Encoding guide** — live pass/fail checklist for every skill.
7. Skill authoring form remains the map CRUD modal.

## Phase 3 (done)

1. **Workflow model** — `workflows`, `workflow_steps`, `workflow_runs`, `run_steps` via Prisma migration; seed sample chains `research-to-calendar` and `hook-to-script-calendar`.
2. **Workflows UI** — list + create/edit ordered skill chain; Citron Volt chrome; detail + dry-run.
3. **Review gates** — content gate `draft → warm → approved → scheduled → published` (published = simulated). Cannot publish without approved.
4. **Run engine (dry-run)** — execute workflow, step skills, write JSON logs/artifacts, no external posts; run trace UI.
5. **Integration stubs** — `/settings/channels` lists Late.dev / Etsy / WhatsApp as **Disconnected** with “Connect in Phase 4”. WhatsApp note: Career path + content creation monetization only when live later.
6. **Home digest** — pending review gates + recent activity + last run summary.
7. Activity events for workflow create / run / approve.
8. Tests + CI green.

## Departments (7)

1. Research Engine  
2. Script & Story  
3. Content Studio  
4. Calendar & Queue  
5. Publish & Channels  
6. Monetization  
7. Proof & Loop  

Center node: **MatOS Agency**.

## Authored skills (seed)

| Skill | Department |
|---|---|
| `hook-lab` | Script & Story |
| `short-script` | Script & Story |
| `content-calendar` | Calendar & Queue |
| `etsy-listing-lab` | Monetization |

Etsy remains a **stub** — no live marketplace API.

## Phase 4 (not started)

Live Late.dev / Etsy OAuth / WhatsApp (scoped) / Stripe — still deferred. No secrets in repo.

## Hosting

Host / deploy deferred. Local `pnpm dev` is the delivery surface.

## Non-goals

- Live social / Etsy / Stripe / WhatsApp Web automation  
- Production OAuth providers  

## Success

Remote `main` runs install → migrate → seed → typecheck → test → `pnpm dev`, Citron aesthetic parity, DB-backed map + knowledge + workflows with dry-run and review gates after owner login (`macnet@matos.local` / `dev`).
