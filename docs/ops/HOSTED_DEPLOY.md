# Hosted deployment

This scaffold describes how to run MatOS outside the local SQLite development database. It does not enable live Stripe.

## Config

Copy `deploy/hosted.env.example` into the host secret manager. Required production values:

- `NODE_ENV=production`
- `AUTH_SECRET` — long random value, not the placeholder in `.env.example`
- `MATOS_AUTH_PASSWORD` — replaces the local `dev` password
- `DATABASE_URL` — a hosted SQLite path or a later managed database URL that is not `dev.db`
- `CREDENTIALS_SECRET` — encrypts integration credentials

Optional provider keys stay empty until a human connects Late/Zernio, Etsy, WhatsApp, newsletter, or blog delivery. Empty keys keep those publishers on the simulated path, and simulated results stay labeled.

## Migrations

From a release checkout, with the hosted `DATABASE_URL` injected:

```bash
pnpm db:migrate
node scripts/check-production-migrations.mjs
```

`pnpm db:migrate` runs `prisma migrate deploy`. The check fails when migrations are pending or when production is pointed at `dev.db`.

Do not run `pnpm db:seed` against a production database that already has operator data. Seed is for local and isolated test databases.

## Tests

The isolated suite never opens `packages/db/prisma/dev.db`:

```bash
pnpm test:isolated
```

## Billing

Leave Stripe environment variables unset. See `docs/ops/BILLING.md`.
