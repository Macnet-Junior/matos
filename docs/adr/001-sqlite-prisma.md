# ADR 001 — SQLite via Prisma as Phase 1 source of truth

**Status:** Accepted  
**Date:** 2026-09-09  
**Deciders:** Macnet Junior (via overnight Phase 1 ship)

## Context

Phase 1 requires a structured source of truth for company / departments / skills with migrations, seed, and mutation APIs. Hosting is deferred. A fake JSON-only toy is explicitly out.

## Decision

Use **Prisma + SQLite** (`packages/db`) with a real `.db` file, Prisma Migrate, and a seed script derived from the commercial department/skill map.

## Alternatives considered

| Option | Why not (now) |
|---|---|
| JSON files only | No migrations, weak concurrency, easy to drift from UI |
| better-sqlite3 hand-rolled SQL | Faster raw access, more boilerplate for schema/migrations |
| Postgres (Neon/etc.) | Best long-term, but needs host decisions deferred in Phase 1 |
| libsql / Turso | Attractive later; Prisma SQLite is enough for local zero-host pain |

## Consequences

- Local `pnpm db:migrate` + `pnpm db:seed` stands up the map.
- CI creates a throwaway SQLite file, migrates, and seeds before tests.
- Moving to Postgres later is a Prisma datasource swap + migrate, not a rewrite of the domain.
- SQLite file is gitignored; schema + migrations are versioned.
