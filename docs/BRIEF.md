# MatOS — Product Brief

**Product:** MatOS  
**Owner:** Macnet Junior  
**Phase:** 4b — connector scaffolding (Late.dev / Etsy / WhatsApp adapters + Connect UI)  
**Accent:** Citron Volt `#D6F31F` (hover `#E8FF5A`, pressed `#B8D110`)

## Intent

Ship a production-minded monorepo that runs locally, matches the Citron Volt dark UI, and models the agency as an interactive company map backed by a real database — not a chatbot skin.

## Phase 0 (done)

Next.js shell, Auth.js credentials login, React Flow map chrome, Citron design system, CI.

## Phase 1 (done)

1. **SQLite via Prisma** (`packages/db`) — migrations + seed for 7 departments and commercial-plan skills.
2. **Map reads from DB** — server load on `/map` + `GET /api/map`.
3. **Auto-arrange** — deterministic layout, persists positions.
4. **Search** — keyboard-accessible filter (⌘K / Ctrl+K).
5. **Owner-gated CRUD** — evolved into RBAC in Phase 4.
6. **Expand/collapse** departments; stats row; tests + ADR.

## Phase 2 (done)

Knowledge corpus, markdown reader, evidence links, status reconcile, encoding guide.

## Phase 3 (done)

Workflows, review gates, dry-run engine, channel stubs, Home digest.

## Phase 4 hardening (done — local, no live OAuth)

1. **RBAC matrix** — roles Owner / Operator / Author / Viewer in `UserRole` + `OWNER_EMAIL`; API enforcement; UI capability flags; permission tests. Dev: `macnet@matos.local` → Owner; `operator@` / `author@` / `viewer@matos.local` seeded.
2. **Security polish** — in-memory rate limits on sensitive POSTs; CSRF note for Auth.js cookies; `/design` blocked in production; `docs/SECURITY.md` checklist updated.
3. **Backup & restore** — `scripts/backup-db.sh` + `scripts/restore-db.sh`; `docs/ops/BACKUP.md`; smoke backup under artifacts.
4. **Performance** — `GET /api/map` skips status reconcile (lean poll), logs timing + `Server-Timing` / `X-Matos-Map-Ms`. Seed map load stays DTO-only JSON (no heavy virtualization needed).
5. **Launch checklist** — `docs/LAUNCH.md`.
6. **Activity export** — Owner download JSON from Activity page (`GET /api/activity/export`).

### Map timing note

Profiled approach: SSR `/map` may reconcile skill statuses once; client/API polls use `reconcile: false`. Seeded lean load profiled at ~7ms avg (cold ~24ms) for 7 departments / 33 skills on local SQLite; `GET /api/map` logs `[map] GET /api/map …ms` plus `Server-Timing` / `X-Matos-Map-Ms`.

## Phase 4b (done — scaffolding; no secrets in repo)

1. **Late.dev / Zernio** — `LATE_API_KEY` + optional `LATE_API_BASE` (default `https://zernio.com/api/v1`). Client lists profiles + creates/schedules posts. Channels Connect form encrypts key into `IntegrationCredential`. Workflow publish attempts live schedule when connected + gate approved; otherwise simulated.
2. **Etsy** — OAuth2 PKCE start/callback routes; shop + draft listing stubs from `etsy-listing-lab` fields.
3. **WhatsApp Cloud** — env token + phone id; **HARD allowlist** on `WHATSAPP_GROUP_OR_TO` (Career path / content creation monetization only). Review gate required before send.
4. **Shared** — Prisma `IntegrationAccount` / `IntegrationCredential`; Channels status Connected/Disconnected/Error + coverage matrix; tests with mocked fetch; `.env.example` documented.

### Still deferred

- Stripe  
- Hosted deploy (Vercel or other)  
- Production auth replacement  
- Unrestricted messaging (explicitly never)  

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

Etsy has OAuth scaffolding + draft stubs — live calls when tokens present.

## Hosting

Host / deploy deferred. Local `pnpm dev` is the delivery surface. See `docs/LAUNCH.md`.

## Non-goals (still)

- Stripe / hosted deploy  
- Unrestricted WhatsApp sending  
- Production OAuth auth replacement for MatOS login  

## Success

Remote `main` runs install → migrate → seed → typecheck → test → `pnpm dev`, Citron aesthetic parity, DB-backed map + knowledge + workflows + RBAC after owner login (`macnet@matos.local` / `dev`).
