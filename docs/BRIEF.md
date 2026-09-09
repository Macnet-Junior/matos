# MatOS — Product Brief

**Product:** MatOS  
**Owner:** Macnet Junior  
**Phase:** 1 — structured map data (SQLite) + CRUD  
**Accent:** Citron Volt `#D6F31F` (hover `#E8FF5A`, pressed `#B8D110`)

## Intent

Ship a production-minded monorepo that runs locally, matches the Citron Volt dark UI, and models the agency as an interactive company map backed by a real database — not a chatbot skin.

## Phase 0 (done)

Next.js shell, Auth.js credentials login, React Flow map chrome, Citron design system, CI.

## Phase 1 (current)

1. **SQLite via Prisma** (`packages/db`) — migrations + seed for 7 departments and commercial-plan skills (`hook-lab`, `short-script`, `content-calendar`, `etsy-listing-lab`, …).
2. **Map reads from DB** — server load on `/map` + `GET /api/map`.
3. **Auto-arrange** — deterministic layout, persists positions (`POST /api/layout`).
4. **Search** — keyboard-accessible filter in map chrome (⌘K / Ctrl+K).
5. **Owner-gated CRUD** — create/edit department & skill with Zod; activity events appended.
6. **Expand/collapse** departments; expanded state persisted for owner.
7. **Stats row** — dept count, authored / planned / missing from DB.
8. Tests for validation + DB payload; CI migrates + seeds before checks.
9. ADR: `docs/adr/001-sqlite-prisma.md`.

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

## Phase 2 (in progress)

- Knowledge markdown reader (`GET /api/knowledge`) + detail panel Knowledge tab shows file body.
- Skill→knowledge links in DB; Knowledge page lists files + links.
- Status derivation: Authored when instructions + existing knowledge files; else Planned/Missing.
- Skill authoring form (purpose, steps, review gate) — shipped in map CRUD modal.
- Encoding guide under Library — stub shipped.
- Remaining: richer evidence attachments, stricter authoring checklist UI, more knowledge docs.

## Hosting

Host / deploy deferred. Local `pnpm dev` is the delivery surface.

## Non-goals

- Live social / Etsy / Stripe integrations  
- Workflow engine execution  
- Production OAuth providers  

## Success

Remote `main` runs install → migrate → seed → typecheck → test → `pnpm dev`, Citron aesthetic parity, and a usable DB-backed company map after owner login (`macnet@matos.local` / `dev`).
