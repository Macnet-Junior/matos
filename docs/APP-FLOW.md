# MatOS — App Flow

**Document 3 of 6.** Product requirement → technical requirement → **app flow** → design brief → schema → implementation plan.

**Status:** written 2026-10-09 against the code as it stands, not as it was intended. Where the app does not yet do what the brief implies, this document says so in **Gap** lines rather than describing the intention as if it shipped.

---

## 1. What this document is for

`plan.md` says what gets built and in what order. `docs/BRIEF.md` says what MatOS is. Neither says **how a person moves through it** — which is why the app currently has 29 pages and no answer to "what do I open first, and then what?"

So this is the flow document: for each surface, who reaches it, what they came for, what state they must be in, and where they go next. It is written to be walked, not read — every section ends in a next step, and the closing section traces the one path that matters most end to end.

**Out of scope here:** wireframes and visual specification (that is document 4, the design brief), and schema definitions (document 5, `packages/db/prisma/schema.prisma`).

---

## 2. Roles

Four roles exist in `UserRole`. What each can actually do is enforced in `apps/web/src/lib/owner.ts` and the API routes, not in the UI — the sidebar hides Ops from non-Owner/Operator, but hiding is not the gate.

**Author** — creates and drafts. Creates briefs, runs stages, edits artifacts. Cannot approve.
**Operator** — Author's powers plus the approval gates. This is the role that makes the human-in-the-loop real.
**Owner** — Operator plus billing, usage, presence, and channel configuration.
**Viewer** — read-only across every surface.

**The one role fact that shapes every flow:** approval is a separate permission from creation, and the same person usually holds both. On a one-person instance the Owner is also the Author, which means the gate is a deliberate pause rather than a second person. Everything downstream depends on that pause meaning something.

---

## 3. Entry

Three ways in, and they are not equivalent.

**`/login`** — the real door. Auth.js credentials, seeded dev logins in `README.md`. A user with no session sees this and cannot proceed.

**`/`** — the root route. **Gap:** this should redirect an authenticated user to `/home` and an unauthenticated one to `/login`. Read the current implementation before relying on it; it is the one route with no documented behaviour.

**`/design`** — the design reference. Not part of any flow, but it is where the Citron Volt system is demonstrated, and document 4 should point at it rather than re-describing it.

---

## 4. The shell

Every page below `/` that matters renders inside `(shell)/layout.tsx`: a fixed 232px sidebar, the page content, and a presence heartbeat running underneath.

The sidebar has six sections, filtered by role:

**Workspace** — Home, Company brief, Company map, Workbook, Repository
**Build & Operate** — Workflows, Skills, Knowledge, Activity, Channels
**Desk** — Desk, Calendar, Inbox
**Ops** — Ops home, Feed, Presence, Usage, Billing, Content, Auto-response *(Owner/Operator only)*
**Support** — Tickets, Chatbot
**Library** — Library, Encoding guide, Desk archive

**Gap:** six sections is a lot of sidebar for a product whose core loop is one of them. The Desk is the product; Workspace and Build & Operate are the machinery that makes the Desk work; Ops is the instrumentation. A newcomer has no signal about which is which. Document 4 should propose the correction, but the flow fixes it too: section 9 below orders the surfaces by when a user actually needs them.

---

## 5. Surfaces, and what each is for

Each surface below is grouped by function, not by sidebar position.

### 5.1 The company layer — Workspace

**`/home`** — the landing surface after login. Company state at a glance. This is where flow 10 starts.

**`/brief`** — the company brief. Positioning, audience, offer. The material the Desk reads when it needs to know who it is talking to.

**`/map`** — the company map. Seven departments (Research Engine, Script & Story, Content Studio, Calendar & Queue, Publish & Channels, Monetization, Proof & Loop) around a MatOS Agency centre node, rendered with React Flow. This is the navigational metaphor of the product: the company as a place rather than a menu.

**`/workbook`** and **`/repository`** — working and reference material.

**Flow:** `/home` → glance → either straight to the Desk (the common case) or into `/map` to think about structure. The map is a thinking surface, not a task surface.

### 5.2 Authored intelligence — Build & Operate

**`/skills`** — authored skills, editable in-app and also as `SKILL.md` files via `apps/skillwright` on port 43123. A skill is authored behaviour the Desk can be told to follow.

**`/knowledge`** — the knowledge base, organised under `knowledge/{brand,content,monetization,research,support}`. Importable and exportable.

**`/workflows`** — multi-step automations, distinct from the Desk. A workflow is a company process that runs; a Desk job is a piece of content that moves. They share the approval-gate pattern but not the pipeline.

**`/activity`** — the audit stream. Every meaningful action lands here. Exportable.

**`/settings/channels`** — channel connection state.

**Flow:** these are surfaces a user *returns to* when the Desk produces a bad draft. The draft is wrong, the reason is usually that a skill or a piece of knowledge is thin, and the fix happens here rather than in the Desk. That return path is the learning loop and it is currently implicit — **Gap:** nothing links a bad artifact back to the skill that produced it.

### 5.3 The Desk — the core loop

This is the product. Six gated stages, and the gate is the point.

**`/desk`** — the job board. Create a brief (topic, audience, offer/CTA, channels, due date), then run it.

**`/desk/[id]`** — one job. The artifact, the edit box, the approval controls. The stage pipeline runs `Scout → Ghost → Editor → Press → Clock → Echo → filed`, with each stage's artifact requiring approval before the next will run. Skipping a gate is a 409 from the API, not a disabled button.

**`/calendar`** — lands after Clock approves. Per-channel content packages, scheduled.

**`/inbox`** — lands after Echo approves. Reply drafts. **The inbox has no send action by design** — statuses are `drafted`, `approved`, `copied`, and no `sent` state exists, because nothing in MatOS sends on the owner's behalf without an explicit out-of-band action.

**`/library/desk`** — filed jobs.

**Flow:** `/desk` → new brief → `/desk/[id]` → run stage → read artifact → edit if needed → approve → next stage → repeat six times → `/calendar` → `/inbox`. A complete job is six approve clicks minimum, and that is the intended cost.

### 5.4 Ops — instrumentation *(Owner/Operator)*

**`/ops`** — Ops home. Feed, Presence, Usage, Billing, Content, Auto-response.

These do not produce content. They answer "is this thing working, what is it costing, and who did what". **Gap:** `/ops/content` and `/ops/usage` read as adjacent but measure different things — content performance from providers, and internal credit consumption. Nothing on the page distinguishes them.

### 5.5 Support

**`/support`** — tickets. **`/support/chat`** — keyword FAQ retrieval that escalates refunds to a ticket rather than inventing an answer. A deliberate non-LLM default.

### 5.6 Library

Reference material, including `/library/encoding-guide`, which is a real operational document rather than a placeholder.

---

## 6. The gate, in detail

Because everything depends on it, one section on how approval actually behaves.

An artifact is created in state `ready`. It can be edited any number of times, each edit writing a revision to `DeskArtifactRevision` — the previous body is preserved, so an edit is never destructive. Only an `approve` moves the job forward. Only Operations/Owner can approve.

**Request changes** is the other exit from a `ready` artifact. **Gap:** the flow for "this draft is wrong" is not documented anywhere and not visible in the UI beyond the button. What a user needs is: what happens to the artifact, does the stage re-run, and is the old version reachable. Check `reviewDeskStage` before promising behaviour here.

Three rules hold everywhere in this section and are worth stating because they are the product's actual claims:

- Nothing propagates to the next stage from an unapproved artifact.
- Nothing publishes without an approved artifact and a connection.
- A simulated result is always labelled simulated. A provider failure falls back visibly and is never recorded as a live post.

---

## 7. Sources and grading — the newest path

Added 2026-10-08, and it does not yet have a home in the UI.

A **source** is the owner's own material — a video, a call, a doc — ingested and transcribed so the Desk can be briefed from something the owner actually said rather than from a topic string. The value is that a transcript carries specifics a model cannot invent: numbers, names, the real objection.

The grading layer checks a transcript against three authored skills — **Hook**, **Loop**, **Pillars** — and reports the first thing to fix, with the failing sentence and its timestamp. Order is deliberate: hook, then loop, then pillars, because that is the order in which they cost the video.

Two behaviours this flow depends on:

- An ingest that produced no speech leaves the source `pending` with a reason. It is never recorded as an empty transcript, because an empty transcript briefs a job with nothing and blames the model for having nothing to say.
- Grading happens at ingest, so the verdict arrives with the transcript. The grade then rides on every later stage's brief as **input**.

**Gap — the significant one:** a source can only be created and linked to a job through the API. There is no UI for creating one, attaching it to a job, or seeing the grade. Until there is, the entire path is reachable only by hand. This is the highest-value missing surface in the product, because it is the one that makes the Desk's output specific rather than generic.

Second gap: the grading refuses to run at all until a real transcription provider is configured. `getTranscriptionProvider()` returns a placeholder that deliberately produces no speech. So this path is complete, tested, and **dormant** until a key is added.

---

## 8. Publishing

**Gap — the largest honesty gap in the product:** the writing half of MatOS is real, and the publishing half is not yet. `publishWithFallback` simulates when no provider is configured, and simulated results are labelled — but there is no live provider on the critical path today.

Flow when a provider is connected: approved Calendar item → publish route → provider resolved → publication record written with an idempotency key → external id stored → delivery reconciled asynchronously → metrics ingested against the publication.

Until then the flow terminates at the Calendar, which is a legitimate end state but not the one the product claims. Anyone reading a Calendar item should be told which of the two they are looking at.

---

## 9. The first-run path

The order a new user should meet these surfaces, which is not the sidebar order.

1. **`/home`** — what this company is right now.
2. **`/brief`** — read it, and edit it if it is wrong. Everything the Desk produces is shaped by this, and a wrong brief produces confidently wrong drafts that look like a Desk problem.
3. **`/desk`** — create one brief. Real topic, real audience.
4. **`/desk/[id]`** — run Scout. Read it. Do not approve yet.
5. **Edit the artifact** once, deliberately, to feel that edits are non-destructive.
6. **Approve** Scout. Watch Ghost appear.
7. Continue to `/calendar` and `/inbox` at least once, so the ending is understood.
8. **`/skills`** — now go fix whatever was thin in step 4. This is the loop.

Steps 3–7 are the product. Everything else in the sidebar supports them.

---

## 10. One job, end to end

The trace, as it exists in code today.

**Create.** Brief written on `/desk` → `createDeskJob` → `DeskJob` at stage `scout`, status `draft`.

**Scout.** Run stage → `runDeskStage` resolves the provider, assembles the brief (title, topic, audience, offer/CTA, channels, due date, plus the grade if the job has a graded source) → artifact written → job status `awaiting_approval`.

**Gate.** Owner reads it. Edits write a revision. Approve → stage advances to `ghost`. Skip → 409.

**Ghost → Editor → Press → Clock.** Same shape, five times. Press produces per-channel packages; Clock materialises them into `DeskCalendarItem` rows, one per channel.

**Echo.** Produces `DeskInboxItem` rows — reply drafts, status `drafted`, no send.

**Filed.** Approving Echo files the job. It appears under `/library/desk`.

**After.** On a connected provider, the Calendar item publishes, a `DeskPublication` records the external id, metrics land in `ContentMetric`, and `/ops/content` shows how it did. That last stretch is the part not yet live.

---

## 11. Gaps, ranked

1. **No source UI.** The grading path is real and unreachable without the API. Highest value because it is what makes drafts specific.
2. **No publishing provider on the critical path.** The product's claim is a closed loop; the loop is currently open at the end.
3. **No app flow for a rejected artifact.** "Request changes" is a button with undocumented consequences.
4. **No link from a bad artifact to the skill that caused it.** The learning loop is described in the brief and absent in the UI.
5. **`/` has no documented redirect behaviour.**
6. **Sidebar order does not match first-run order.** Section 9 is the fix.
7. **`/ops/content` and `/ops/usage` are not distinguished** for a reader who has not memorised the schema.

**Recommended first move:** item 1, the source UI, because it is the shortest path to the Desk producing something only this owner could have produced. Items 2 and 4 are bigger and belong in the plan; items 3, 5, 6, 7 are documentation and small UI work that can land alongside anything.
