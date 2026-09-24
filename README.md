# MatOS

**MatOS** is a company operating layer: a precision dark workspace where your agency is modeled as a living map of departments and authored skills.

Phase 5 ships **Ops & Support**: live feed, presence heartbeats, usage meters, stub credits/billing, gated auto-response, tickets, and FAQ chatbot. Phase **5.5** adds **Relay Desk** (newsroom pipeline: `/desk`, `/calendar`, `/inbox`) — see `docs/DESK.md`. Phase 4b connectors + Phase 4 RBAC remain. **Live channel publish / Stripe charges / host deploy still deferred.**

## Design

| Token | Value |
|---|---|
| Accent (Citron Volt) | `#D6F31F` |
| Hover | `#E8FF5A` |
| Pressed | `#B8D110` |
| Backgrounds | `#0b0c0e` · `#12141a` · `#161922` |
| Borders | `#2a2e3a` |
| Muted text | `#8b93a7` |

Aesthetic: Linear / Raycast–class precision dark UI. No purple gradients.

## Structure

```
apps/web          Next.js App Router + Auth.js + map UI + APIs
packages/db       Prisma schema, migrations, seed (SQLite)
packages/ui       Citron tokens, Button, Panel, Badge
docs/             BRIEF, SECURITY, LAUNCH, ADRs, ops/
knowledge/        Canonical markdown stubs
scripts/          backup-db.sh, restore-db.sh
```

## Prerequisites

- Node.js 20+
- pnpm 9+ (`npm install -g pnpm@9`)

## Install & run

```bash
git clone https://github.com/Macnet-Junior/matos.git
cd matos

pnpm install

cp .env.example apps/web/.env.local
# Set AUTH_SECRET (openssl rand -base64 32)
# Set DATABASE_URL to an absolute sqlite path, e.g.
# DATABASE_URL="file:/ABS/PATH/matos/packages/db/prisma/dev.db"
# Set OWNER_EMAIL=macnet@matos.local

pnpm db:migrate
pnpm db:seed

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Dev logins (password `dev`)

| Email | Role |
|---|---|
| `macnet@matos.local` | **Owner** (also forced by `OWNER_EMAIL`) |
| `operator@matos.local` | Operator — run + approve |
| `author@matos.local` | Author — edit skills |
| `viewer@matos.local` | Viewer — read-only |
| any other email | Viewer (default) |

One-click **Continue as Macnet Junior** works too.

### Assigning roles

Roles live in the `UserRole` SQLite table (`email` unique → `Owner` \| `Operator` \| `Author` \| `Viewer`).

```bash
# Example: promote an author (Prisma Studio or SQL)
pnpm --filter @matos/db studio
# Or re-seed defaults: pnpm db:seed
```

`OWNER_EMAIL` always resolves as Owner even if the DB row differs. See `docs/LAUNCH.md` and `apps/web/src/lib/rbac.ts`.

### Relay Desk (Phase 5.5)

Sidebar **Desk** → Desk / Calendar / Inbox. Six gated stages (Scout→Echo), Library desk archive. Placeholder LLM without `OPENAI_API_KEY`. Publishing requires Desk approval; simulated fallbacks stay labeled. Details: [`docs/DESK.md`](docs/DESK.md).

Isolated tests use `packages/db/prisma/.test/suite.db` and do not open the development database. See [`docs/ops/HOSTED_DEPLOY.md`](docs/ops/HOSTED_DEPLOY.md).

### Ops & Support (Phase 5)

- `/ops/*` — Owner/Operator meters (feed, presence, usage, billing, auto-response)
- `/support` + `/support/chat` — tickets + FAQ chatbot for all roles
- Heartbeat: shell POSTs `/api/ops/presence` every ~30s


## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js on :3000 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript strict |
| `pnpm test` | Vitest on the isolated SQLite suite (never `dev.db`) |
| `pnpm test:isolated` | Same isolated full suite. Documented command for CI and Windows. |
| `pnpm build` | Production build |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Seed departments, skills, workflows, roles |
| `pnpm audit` | Dependency audit (prod) |
| `./scripts/backup-db.sh` | SQLite backup |
| `./scripts/restore-db.sh <file>` | SQLite restore |

## Auth & security

Credentials provider only (dev). Mutations gated by RBAC. See `docs/SECURITY.md`, `docs/LAUNCH.md`, `docs/ops/BACKUP.md`.

## Phase 4 surfaces

| Route | Purpose |
|---|---|
| `/activity` | Trail + Owner **Download JSON** |
| `/skills` | Skill list + Owner/Author **Export JSON** / **Import JSON** |
| `/knowledge` | Markdown browser + Owner/Author **Export ZIP** / **Import ZIP** (merge) |
| `/workflows` | Chains; Operator can dry-run |
| `/settings/channels` | Late.dev / Etsy / WhatsApp stubs |
| `docs/LAUNCH.md` | Env + deferred host/connect steps |

## Out of scope (Phase 4b)

Live Etsy / Late.dev / WhatsApp Web / Stripe OAuth, deploy host.

## License

Private — Macnet Junior.
