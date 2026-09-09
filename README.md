# MatOS

**MatOS** is a company operating layer: a precision dark workspace where your agency is modeled as a living map of departments and authored skills.

Phase 0 ships a runnable monorepo with Citron Volt UI, credentials auth (dev login), and an interactive company map.

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
apps/web          Next.js App Router + Auth.js + company map
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
# Ensure AUTH_SECRET is set (openssl rand -base64 32)

pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with any email + password `dev`, or click **Continue as Macnet Junior**.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start Next.js on :3000 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript strict |
| `pnpm test` | Vitest smoke tests |
| `pnpm build` | Production build |
| `pnpm audit` | Dependency audit (prod) |

Filter a package: `pnpm --filter web typecheck`

## Auth (Phase 0)

Credentials provider only. No OAuth. Set `AUTH_SECRET` in `apps/web/.env.local`. See `.env.example` and `docs/SECURITY.md`.

## Out of scope (Phase 0)

Live Etsy / social APIs, Stripe, deploy, workflow engine.

## License

Private — Macnet Junior.
