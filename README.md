# MatOS

**MatOS** is a company operating layer: a precision dark workspace where your agency is modeled as a living map of departments and authored skills.

Phase 3 ships workflows (ordered skill chains), review gates, dry-run execution with JSON artifacts, Home digest, and Disconnected channel stubs — on top of the SQLite map, knowledge, and Citron Volt UI.

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
docs/             BRIEF, SECURITY, ADRs
knowledge/        Canonical markdown stubs
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

pnpm db:migrate
pnpm db:seed

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in as **macnet@matos.local** + password `dev` (owner), or any email + `dev` (viewer). One-click **Continue as Macnet Junior** works too.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js on :3000 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript strict |
| `pnpm test` | Vitest |
| `pnpm build` | Production build |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Seed 7 departments + skills |
| `pnpm audit` | Dependency audit (prod) |

## Auth

Credentials provider only. Mutations require `OWNER_EMAIL` (default `macnet@matos.local`). No OAuth. See `docs/SECURITY.md`.

## Phase 3 surfaces

| Route | Purpose |
|---|---|
| `/workflows` | List / create skill chains |
| `/workflows/[id]` | Edit chain, advance gate, dry-run |
| `/workflows/runs/[runId]` | Run trace (logs + artifacts) |
| `/home` | Pending gates + activity + last run |
| `/settings/channels` | Late.dev / Etsy / WhatsApp stubs |

## Out of scope

Live Etsy / Late.dev / WhatsApp Web / Stripe OAuth, deploy host.

## License

Private — Macnet Junior.
