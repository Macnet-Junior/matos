# MatOS — Product Brief

**Product:** MatOS  
**Owner:** Macnet Junior  
**Phase:** 2 — knowledge, evidence links, encoding checklist  
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

1. **Knowledge corpus** — markdown under `knowledge/` (brand voice, mix ratios, Etsy stub + listing checklist, offers, research notes) with skill→file links in SQLite.
2. **Knowledge reader** — `GET /api/knowledge`; Knowledge page + detail Knowledge tab preview via **react-markdown** (safe render).
3. **Instructions markdown** — skill instructions tab renders markdown the same way.
4. **Evidence links** — URL + label stored in `evidenceJson`; owner can add/remove in the Evidence tab (no binary uploads).
5. **Status reconcile** — on map load (and after skill create/update), derived Authored/Planned/Missing is synced back to `skills.status`.
6. **Encoding guide** — live pass/fail checklist (purpose, steps, review gate, ≥1 knowledge link) for every skill.
7. Skill authoring form remains the map CRUD modal (purpose, steps, review gate, knowledge paths).

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

## Phase 3 (not started)

Deferred integrations: Late.dev, Etsy OAuth, WhatsApp, Stripe, workflow execution.

## Hosting

Host / deploy deferred. Local `pnpm dev` is the delivery surface.

## Non-goals

- Live social / Etsy / Stripe integrations  
- Workflow engine execution  
- Production OAuth providers  

## Success

Remote `main` runs install → migrate → seed → typecheck → test → `pnpm dev`, Citron aesthetic parity, DB-backed company map with knowledge + evidence + encoding checklist after owner login (`macnet@matos.local` / `dev`).
