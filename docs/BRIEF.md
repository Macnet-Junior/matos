# MatOS — Product Brief

**Product:** MatOS  
**Owner:** Macnet Junior  
**Phase:** 5.5 — Relay Desk  
**Accent:** Citron Volt `#D6F31F` (hover `#E8FF5A`, pressed `#B8D110`)

## Intent

Ship a production-minded monorepo that runs locally, matches the Citron Volt dark UI, and models the agency as an interactive company map backed by a real database — not a chatbot skin.

## Phase 0–4b (done)

Next.js shell, Auth.js, React Flow map, Prisma SQLite, knowledge, workflows, RBAC, backups, Late/Etsy/WhatsApp connector scaffolding. See prior sections in git history / LAUNCH.

## Phase 5 — Ops & Support (done)

1. **Live feed** (`/ops/feed`) — Activity stream with type filters; client polls ~4s.
2. **Presence** (`/ops/presence` + Ops home) — `UserPresence` heartbeat every ~30s from shell; online count.
3. **Usage** (`/ops/usage`) — `UsageEvent` meters (AI credits, Late, Etsy, WhatsApp, API hits); table + CSS/SVG charts. Instrumented on adapter/sim paths.
4. **Billing** (`/ops/billing`) — Credit balance + ledger + stub pricing. **Stripe connect — Phase 4b later** (not live). Owner credit grant UI.
5. **Auto-response desk** (`/ops/auto-response`) — Rules require Owner/Operator + **approved** review gate before enable. Attempt log. No spam growth bots.
6. **Support center** (`/support`) — Tickets (open/pending/solved), priority, assignee; FAQs from `knowledge/support/`.
7. **Support chatbot** (`/support/chat`) — Keyword FAQ retrieval; escalate refunds to ticket; no fake LLM without key.

### Nav

- **Ops** (Owner/Operator): Feed, Presence, Usage, Billing, Auto-response  
- **Support** (all roles): Tickets, Chatbot  

### Data

Prisma: `UserPresence`, `UsageEvent`, `CreditLedger`, `AutoResponseRule`, `AutoResponseAttempt`, `SupportTicket`, `SupportMessage`, `ChatThread`, `ChatMessage`.


## Phase 5.5 — Relay Desk (in progress / shipped on branch)

Newsroom mode inside the web app: `/desk`, `/calendar`, `/inbox`, Library desk archive.
Six gated stages (Scout→Echo), placeholder LLM, no live publish. See `docs/DESK.md`.

### Still deferred

- Live Stripe charges  
- Hosted deploy  
- Production auth replacement  
- Unrestricted messaging (explicitly never)  
- Real LLM support chat (optional when `OPENAI_API_KEY` present — v1 is deterministic FAQ)

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

## Hosting

Host / deploy deferred. Local `pnpm dev` is the delivery surface. See `docs/LAUNCH.md`.

## Non-goals (still)

- Stripe live charges / hosted deploy  
- Unrestricted WhatsApp / auto-DM spam  
- Production OAuth auth replacement for MatOS login  

## Success

Remote `main` runs install → migrate → seed → typecheck → test → `pnpm dev`, Citron aesthetic parity, DB-backed map + knowledge + workflows + RBAC + Phase 5 ops/support after owner login (`macnet@matos.local` / `dev`).
