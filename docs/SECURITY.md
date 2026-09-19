# MatOS Security Notes (Phase 4 hardening)

## Principles

- No backdoors, hidden admin routes, or debug auth bypasses in shipped code.
- Secrets never in the client bundle or git history.
- Least privilege via RBAC; review gates for anything that posts externally or spends money (Phase 4b).

## Secrets policy

| Secret | Where | Notes |
|---|---|---|
| `AUTH_SECRET` | Server env only | Required by Auth.js. Generate with `openssl rand -base64 32`. Never commit `.env.local`. |
| Provider keys | Server env + encrypted DB | Late / Etsy / WhatsApp via env or `IntegrationCredential` (AES-256-GCM). Never commit real keys. Stripe still deferred. |
| `CREDENTIALS_SECRET` | Server env only | Encrypts stored integration secrets. |

`.env.example` documents variable names only — placeholder values only.

## Auth & RBAC

- Credentials provider for **local development** (password `dev`).
- Dev logins: `macnet@matos.local` → **Owner** (also via `OWNER_EMAIL`); seeded `operator@`, `author@`, `viewer@matos.local`.
- Roles enforced on mutating APIs: Owner full CRUD; Operator run+approve; Author skill edit; Viewer read-only.
- Sessions are JWT via Auth.js; `AUTH_SECRET` signs tokens.
- This credentials path is intentionally weak and must **not** ship as production auth without replacing the provider.

## CSRF (cookie / session note)

Auth.js v5 with the JWT strategy sets an HTTP-only session cookie and uses its built-in CSRF token for the credentials sign-in flow (`/api/auth/csrf` + callback). MatOS mutating APIs rely on that same-site session cookie:

- Keep cookies `SameSite=Lax` (Auth.js default) so cross-site POSTs do not carry the session.
- Do not disable Auth.js CSRF for the credentials provider.
- If you later add cookie-based form posts from third-party origins, add explicit CSRF tokens — not needed for current same-origin `fetch` from the App Router UI.
- Never expose `AUTH_SECRET` to the client.

## Rate limiting

Sensitive POSTs (map/skill/workflow mutations, runs, gate advances, activity export, skills/knowledge import) and bulk downloads (activity / skills JSON / knowledge zip) use a simple **in-memory** per-process rate limiter (`apps/web/src/lib/rate-limit.ts`). Returns HTTP 429 when exceeded. Replace with Redis / edge limits before multi-node production.

Skills and knowledge import/export reuse `skill:edit` (Owner + Author) via `requireSkillPackageExport` / `requireSkillPackageImport` — no new role. Knowledge zip entries are path-joined only under `knowledge/` (traversal rejected; merge overwrite, no wipe).

## Debug routes

- `/design` design-token preview is **blocked in production** (middleware 404 + page `notFound()`).
- No debug auth bypass routes ship in the production build.

## CSP & headers

`apps/web/next.config.ts` sets starter security headers:

- `Content-Security-Policy` (starter — tighten before public deploy)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/mic/geolocation off)
- `X-Powered-By` disabled

## Checklist before any public deploy

- [x] No debug `/design` route in production builds
- [x] RBAC enforced on mutating APIs (Owner / Operator / Author / Viewer)
- [x] Rate-limit sensitive POSTs (in-memory; upgrade for multi-node)
- [x] CSRF posture documented for Auth.js cookie sessions
- [x] Review gate model for publish path (dry-run / simulated publish only)
- [ ] Replace credentials provider with strong auth (or add OAuth + MFA)
- [ ] Rotate and inject `AUTH_SECRET` via secret manager
- [ ] Tighten CSP (remove `'unsafe-inline'` / `'unsafe-eval'` if present)
- [ ] Enable HTTPS only; set secure cookie flags
- [ ] Dependency audit (`pnpm audit`) clean for criticals
- [ ] No sample passwords accepted in production builds
- [x] Live channel actions behind Owner connect + review gate (Phase 4b scaffolding)
- [x] WhatsApp destination hard allowlist (`WHATSAPP_GROUP_OR_TO` only)
- [ ] Stripe / spend actions

## Reporting

Security issues: contact the repo owner (Macnet Junior) privately. Do not open public issues with exploit details.


## Phase 4b credentials & WhatsApp allowlist

- Integration secrets are encrypted at rest (`apps/web/src/lib/integrations/credentials.ts`) and never returned to the client after save (masked hint only).
- Do not log decrypted secrets or raw `Authorization` headers containing user keys.
- WhatsApp Cloud sends are **hard-bound** to `WHATSAPP_GROUP_OR_TO` (Career path / content creation monetization). Any other `to` is rejected in code.
- WhatsApp send API requires `workflow:approve` permission and `reviewGateApproved: true`.
