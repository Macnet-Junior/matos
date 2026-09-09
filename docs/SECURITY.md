# MatOS Security Notes (Phase 0)

## Principles

- No backdoors, hidden admin routes, or debug auth bypasses in shipped code.
- Secrets never in the client bundle or git history.
- Least privilege; review gates for anything that posts externally or spends money (future phases).

## Secrets policy

| Secret | Where | Notes |
|---|---|---|
| `AUTH_SECRET` | Server env only | Required by Auth.js. Generate with `openssl rand -base64 32`. Never commit `.env.local`. |
| Provider keys | Deferred | No OAuth / Etsy / Stripe keys in Phase 0. |

`.env.example` documents variable names only — placeholder values only.

## Auth (Phase 0)

- Credentials provider for **local development**.
- Dev login: any email + password `dev`, or one-click **Continue as Macnet Junior**.
- This is intentionally weak and must **not** ship as production auth without replacing the provider and locking down the password path.
- Sessions are JWT via Auth.js; `AUTH_SECRET` signs tokens.

## CSP & headers

`apps/web/next.config.ts` sets starter security headers:

- `Content-Security-Policy` (starter — tighten before public deploy)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera/mic/geolocation off)

## Checklist before any public deploy

- [ ] Replace credentials provider with strong auth (or add OAuth + MFA)
- [ ] Rotate and inject `AUTH_SECRET` via secret manager
- [ ] Tighten CSP (remove `'unsafe-inline'` / `'unsafe-eval'` if present)
- [ ] Enable HTTPS only; set secure cookie flags
- [ ] Dependency audit (`pnpm audit`) clean for criticals
- [ ] No sample passwords accepted in production builds
- [ ] Review gate for external publish / spend actions

## Reporting

Security issues: contact the repo owner (Macnet Junior) privately. Do not open public issues with exploit details.
