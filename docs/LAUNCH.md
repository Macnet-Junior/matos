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
| `CREDENTIALS_SECRET` | Recommended | Encrypts IntegrationCredential; falls back to AUTH_SECRET-derived key |
| `LATE_API_KEY` | Optional | Late.dev / Zernio — without it, schedule stays simulated |
| `LATE_API_BASE` | Optional | Default `https://zernio.com/api/v1` |
| `ETSY_API_KEY` | Optional | Etsy keystring for OAuth |
| `ETSY_SHARED_SECRET` | Optional | Etsy shared secret (if issued) |
| `ETSY_REDIRECT_URI` | Optional | Default `http://localhost:3000/api/integrations/etsy/oauth/callback` |
| `WHATSAPP_TOKEN` | Optional | Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | Sending phone number id |
| `WHATSAPP_GROUP_OR_TO` | Optional | **Sole** allowed destination (Career path / content monetization) |

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

## Phase 4b connectors

Without keys: Connect UI + mocked/simulated publish paths work. With keys: Late schedule, Etsy OAuth, WhatsApp allowlisted send (gate required).

## Deferred — do not block local launch

- [ ] Host / Vercel (or other) deploy
- [ ] Stripe
- [ ] Replace credentials provider for production auth
- [x] Late.dev / Zernio adapter + Connect UI (scaffolding)
- [x] Etsy OAuth scaffolding
- [x] WhatsApp allowlisted send scaffolding

## Pre-flight

- [ ] `pnpm lint && pnpm typecheck && pnpm test`
- [ ] `pnpm build` succeeds; `/design` returns 404 in production
- [ ] Backup drill once (`docs/ops/BACKUP.md`)
- [ ] `docs/SECURITY.md` checklist reviewed
