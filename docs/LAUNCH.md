# MatOS launch checklist

Local-first launch (host deferred). Complete before any public URL.

## Env vars

Copy `.env.example` → `apps/web/.env.local` (and `packages/db/.env` if running Prisma alone):

| Var | Required | Notes |
|---|---|---|
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` — signs Auth.js JWTs |
| `AUTH_URL` | Recommended | e.g. `http://localhost:3000` |
| `DATABASE_URL` | Yes | Absolute `file:/…/packages/db/prisma/dev.db` for Next |
| `OWNER_EMAIL` | Yes | Default `macnet@matos.local` — always resolves as **Owner** |

## Bootstrap

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Login: `macnet@matos.local` / `dev` (Owner). Other seeded emails (password `dev`): `operator@`, `author@`, `viewer@matos.local`.

## Roles (quick)

| Role | Capabilities |
|---|---|
| Owner | Full CRUD, run, approve, activity export |
| Operator | Run workflows + advance review gates |
| Author | Edit / create skills |
| Viewer | Read-only |

Assign roles: upsert rows in `UserRole` (see README) or keep `OWNER_EMAIL`.

## Deferred — do not block local launch

- [ ] Host / Vercel (or other) deploy
- [ ] Late.dev OAuth connect
- [ ] Etsy OAuth / marketplace API
- [ ] WhatsApp Business connect (Career + content monetization scope only)
- [ ] Stripe
- [ ] Replace credentials provider for production auth

## Pre-flight

- [ ] `pnpm lint && pnpm typecheck && pnpm test`
- [ ] `pnpm build` succeeds; `/design` returns 404 in production
- [ ] Backup drill once (`docs/ops/BACKUP.md`)
- [ ] `docs/SECURITY.md` checklist reviewed
