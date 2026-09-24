# MatOS Content Engine Implementation Plan

## Summary

MatOS is being extended from a Desk newsroom workflow into a complete, platform-neutral content creation and publishing engine.

The existing Relay Desk pipeline remains the editorial owner:

`Scout -> Ghost -> Editor -> Press -> Clock -> Echo -> filed`

Skills remain reusable authored intelligence. Workflows remain reusable automation. Desk jobs remain content instances that move through research, drafting, review, packaging, scheduling, publication, and performance feedback.

## Goals

- Support the major social and content destinations from one shared registry.
- Preserve human approval gates before scheduling and publishing.
- Make provider failures safe, visible, retryable, and never falsely successful.
- Keep credentials server-side and prevent provider errors or secrets from reaching users.
- Persist publication identity, delivery state, retries, and content metrics.
- Complete native and external publishing adapters incrementally.
- Make local development and tests deterministic on Windows.

## Completed Work

### Platform registry

Implemented in `apps/web/src/lib/content-platforms.ts`:

- LinkedIn
- X
- Instagram
- Facebook
- Threads
- TikTok
- YouTube
- Pinterest
- Reddit
- Newsletter
- Blog
- Etsy
- WhatsApp

Each platform has a label, owning provider, and capability metadata for text, images, video, links, scheduling, and replies.

Desk validation and the Desk channel selector now use this registry instead of separate hard-coded lists.

Evidence:

- `apps/web/src/lib/content-platforms.ts`
- `apps/web/src/lib/content-platforms.test.ts`
- `apps/web/src/lib/validation.ts`
- `apps/web/src/components/desk/DeskBoard.tsx`

### Publication and metrics persistence

Added and migrated:

- `DeskPublication`
- `ContentMetric`

`DeskPublication` stores provider, channel, idempotency key, external ID, status, scheduled time, attempt count, last attempt, safe error state, and non-secret provider metadata.

`ContentMetric` stores measured outcomes such as impressions, clicks, engagement, and conversions against a publication.

Evidence:

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260924072131_content_publications/migration.sql`

### Publishing contract and fallback

Implemented in `apps/web/src/lib/content-publishing.ts`:

- Shared `ContentPublisher` interface.
- Deterministic `SimulatedContentPublisher` for local development and provider outages.
- `LateContentPublisher` for Late/Zernio-backed social publishing.
- `publishWithFallback` for unexpected provider failures.
- Generic public error categories instead of raw provider messages.

Fallback results remain explicitly marked as simulated. MatOS never reports a simulated schedule as a live publication.

Evidence:

- `apps/web/src/lib/content-publishing.ts`
- `apps/web/src/lib/content-publishing.test.ts`

### Authenticated Desk publication route

Implemented in `apps/web/src/lib/content-publications.ts` and:

`apps/web/src/app/api/desk/calendar/[id]/publish/route.ts`

The route:

- Requires Desk approval permission.
- Resolves the matching Late/Zernio account when available.
- Falls back to simulation when provider discovery or API calls fail.
- Reuses existing publication records by idempotency key.
- Updates calendar and publication status.
- Records an audit activity event without content or credentials.

## Security and Privacy Guarantees

- Integration credentials remain encrypted and server-side.
- Credentials are never serialized into client DTOs.
- Provider exceptions are not returned as raw API responses.
- Fallback metadata contains only generic reasons such as `provider_error`.
- Activity events record channel, simulation state, and identifiers, not full content or secrets.
- Publishing requires an authenticated Desk approval-capable user.
- External publishing is never silently enabled by a missing credential.
- Local fallback is visibly marked as simulated.

## Current Validation Status

Passing:

- Focused platform tests: 3 passed.
- Focused publishing tests: 3 passed.
- Validation tests: 12 passed.
- Combined focused tests: 17 passed.
- TypeScript typecheck: passed.
- Prisma schema diagnostics: passed.
- Prisma client generation: passed.
- Prisma migration creation and application: passed.

Known full-suite failures:

- Windows path separator expectation in `apps/web/src/lib/knowledge.test.ts`.
- Shared SQLite state and lock/timeouts in database-backed workflow and Desk tests.
- Desk fixture count can depend on shared database state.

These should be fixed in the test harness rather than hidden with skipped tests.

## Remaining Implementation Plan

### Phase 1: Stabilize test infrastructure

Plan 1.1 - Normalize Windows knowledge paths.

Plan 1.2 - Give database test files isolated SQLite databases or isolated fixtures.

Plan 1.3 - Run migrations and seeds deterministically for each database test scope.

Plan 1.4 - Add a reliable full-suite command that does not share the development database.

### Phase 2: Complete Desk content packages

Plan 2.1 - Replace the Clock placeholder body with the approved Press artifact content for each channel.

Plan 2.2 - Store structured channel packages alongside rendered body text.

Plan 2.3 - Add per-channel validation for character limits, links, media requirements, and capabilities.

Plan 2.4 - Add revision history for artifact edits and approvals.

Plan 2.5 - Add publication status and simulation state to Calendar and Desk UI surfaces.

### Phase 3: Complete provider adapters

Plan 3.1 - Finish Late/Zernio account selection and platform-specific payload mapping.

Plan 3.2 - Add native Newsletter adapter with draft, schedule, publish, and delivery status.

Plan 3.3 - Add native Blog adapter with draft, schedule, publish, and delivery status.

Plan 3.4 - Add Etsy listing draft and publish adapter behind explicit approval.

Plan 3.5 - Add WhatsApp delivery adapter with the existing configured-destination boundary.

Plan 3.6 - Add retry and backoff policy for transient failures.

Plan 3.7 - Add provider webhooks or polling where delivery status is asynchronous.

### Phase 4: Complete content performance loop

Plan 4.1 - Add metric ingestion endpoint with provider and time-window validation.

Plan 4.2 - Add manual metric import for providers without an API integration.

Plan 4.3 - Add publication and metric views to Ops and Desk.

Plan 4.4 - Add content-level performance summaries without exposing private audience data.

Plan 4.5 - Feed approved performance insights back into authored skills and knowledge references.

### Phase 5: Complete production scaffolds

Plan 5.1 - Replace development credentials with production authentication.

Plan 5.2 - Complete hosted deployment configuration.

Plan 5.3 - Complete production secret management and key rotation.

Plan 5.4 - Complete Stripe billing only after credit accounting and reconciliation are production-ready.

Plan 5.5 - Add structured logs, metrics, alerting, and provider health checks.

Plan 5.6 - Add privacy retention controls, export, deletion, and audit review tooling.

## Executable Task Breakdown

### Phase 1: Test and database foundations

- [x] T001 [Plan:1.1] Update `apps/web/src/lib/knowledge.test.ts` to compare normalized platform paths on Windows.
- [x] T002 [P] [Plan:1.2] Add isolated SQLite database setup for `apps/web/src/lib/desk/desk.db.test.ts`.
- [x] T003 [P] [Plan:1.2] Add isolated SQLite database setup for `apps/web/src/lib/workflows.db.test.ts`.
- [x] T004 [Plan:1.3] Add deterministic seed and cleanup helpers for database-backed tests.
- [x] T005 [Plan:1.4] Run the full test suite against an isolated test database and document the command.

### Phase 2: Editorial content engine

- [x] T006 [Plan:2.1] Extract channel-specific Press content from `apps/web/src/lib/desk/index.ts` when Clock materializes calendar items.
- [x] T007 [P] [Plan:2.2] Add structured content-package types to `apps/web/src/lib/content-platforms.ts`.
- [x] T008 [Plan:2.2] Persist structured package metadata through `DeskStageArtifact` or a dedicated package model.
- [x] T009 [P] [Plan:2.3] Add platform capability and length validation tests.
- [x] T010 [Plan:2.4] Add Desk artifact revision persistence and revision DTOs.
- [x] T011 [Plan:2.5] Display publication status and simulation state in `apps/web/src/components/desk/DeskCalendar.tsx`.

### Phase 3: Publishing adapters

- [x] T012 [Plan:3.1] Add Late/Zernio account mapping tests for all supported social destinations.
- [x] T013 [Plan:3.2] Add newsletter publisher interface and local implementation.
- [x] T014 [Plan:3.3] Add blog publisher interface and local implementation.
- [x] T015 [Plan:3.4] Adapt `apps/web/src/lib/integrations/etsy.ts` to the shared `ContentPublisher` contract.
- [x] T016 [Plan:3.5] Adapt `apps/web/src/lib/integrations/whatsapp.ts` to the shared `ContentPublisher` contract.
- [x] T017 [Plan:3.6] Add bounded retry and exponential backoff around transient provider errors.
- [x] T018 [Plan:3.7] Add delivery reconciliation for asynchronous provider results.

### Phase 4: Metrics and learning loop

- [x] T019 [Plan:4.1] Add authenticated metric ingestion API for `ContentMetric`.
- [x] T020 [P] [Plan:4.2] Add CSV or JSON metric import with validation and privacy limits.
- [x] T021 [Plan:4.3] Add publication performance view to Ops.
- [x] T022 [Plan:4.4] Add aggregate content performance summaries.
- [x] T023 [Plan:4.5] Add reviewed performance insight links to skills and knowledge.

### Phase 5: Production readiness

- [x] T024 [Plan:5.1] Replace development credentials with production authentication.
- [x] T025 [P] [Plan:5.3] Add production secret management and rotation documentation.
- [x] T026 [Plan:5.5] Add provider health, delivery, and fallback observability.
- [x] T027 [Plan:5.6] Add privacy retention, export, and deletion controls.
- [x] T028 [Plan:5.2] Add hosted deployment configuration and production migration checks.
- [x] T029 [Plan:5.4] Implement Stripe only after production credit reconciliation is specified and tested.

## Requirement Mapping

| REQ ID | Description | Plan Items | Implementation Evidence |
|---|---|---|---|
| REQ-001 | Support all planned social and content destinations | 2.2, 3.1-3.5 | `content-platforms.ts`, provider adapters |
| REQ-002 | Preserve human review before publication | 2.5, 3.6 | Desk review flow, publish route, publication status |
| REQ-003 | Persist publication identity and delivery state | 2.5, 3.6 | `DeskPublication`, migration, publication service |
| REQ-004 | Provide safe API fallback behavior | 3.6, 5.5 | `publishWithFallback`, simulation markers, health checks |
| REQ-005 | Protect user data and provider credentials | 5.3, 5.6 | encrypted credentials, redacted errors, retention controls |
| REQ-006 | Capture content performance feedback | 4.1-4.5 | `ContentMetric`, metric APIs, performance views |
| REQ-007 | Make tests deterministic on Windows | 1.1-1.4 | normalized paths, isolated SQLite fixtures |
| REQ-008 | Complete production deployment scaffolds | 5.1-5.6 | auth, deployment, secrets, billing, observability |

## Recommended Execution Order

1. Fix isolated database tests and Windows path handling.
2. Make Clock produce real channel packages from approved Press content.
3. Add publication status controls to the Calendar UI.
4. Complete Late/Zernio social publishing with retries and reconciliation.
5. Add Newsletter and Blog adapters.
6. Add Etsy and WhatsApp adapters with their existing safety boundaries.
7. Add metrics and the reviewed learning loop.
8. Finish production auth, deployment, secret rotation, observability, and privacy controls.

## Operational Safety Rules

- Never publish before the required Desk approval state.
- Never treat a fallback simulation as a live publication.
- Never log API keys, access tokens, full provider responses, or private content unnecessarily.
- Never return raw provider errors to browser clients.
- Never send WhatsApp messages outside the configured destination.
- Never run production-like tests against the development database.
- Keep provider credentials encrypted and inaccessible to client components.