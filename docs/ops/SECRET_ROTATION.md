# Secret rotation

MatOS keeps integration credentials and auth secrets on the server. Nothing in this document is a live secret. Do not commit filled `.env` files, database snapshots, or provider responses.

## What to rotate

| Name | Where it lives | When to rotate |
|---|---|---|
| `AUTH_SECRET` | Host secret manager | On suspected session leak, staff departure, or every 90 days |
| `MATOS_AUTH_PASSWORD` | Host secret manager | When a person who knew the production password leaves, or every 90 days |
| `CREDENTIALS_SECRET` | Host secret manager | Before re-encrypting `IntegrationCredential` rows |
| `LATE_API_KEY` | Host env or encrypted credential row | When Late/Zernio revokes a key or a workstation is lost |
| `ETSY_API_KEY` / `ETSY_SHARED_SECRET` | Host env | When the Etsy app secret is exposed |
| `WHATSAPP_TOKEN` | Host env | When the Cloud API token expires or is exposed |
| `OPENAI_API_KEY` | Host env | On provider rotation |

`WHATSAPP_GROUP_OR_TO` is an allowlist, not a secret, but changing it is a production change: WhatsApp delivery refuses every other destination.

## Rotation steps

1. Create the new value in the provider or with `openssl rand -base64 32`.
2. Store it in the host secret manager. Do not paste it into git, tickets, or client logs.
3. Deploy the new value. For `CREDENTIALS_SECRET`, re-save integration credentials after the new key is live so ciphertext matches.
4. Revoke the previous provider key.
5. Confirm Desk publish still shows `simulated` when the provider is disconnected, and that logs contain only `provider_error`, `provider_timeout`, or `provider_unavailable`.

## Local development

Local Desk login accepts password `dev` only when `NODE_ENV` is not `production`. Production rejects `dev`, empty values, and the placeholder `replace-with-a-long-random-secret`.

## Checks

- `pnpm --filter web exec vitest run src/lib/auth-credentials.test.ts src/lib/production-readiness.test.ts`
- `node scripts/check-production-migrations.mjs` against the hosted `DATABASE_URL`
