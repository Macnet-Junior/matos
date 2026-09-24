# Relay Desk (Phase 5.5)

Desk is the MatOS **newsroom** mode: brief → six gated stages → calendar packs → inbox reply drafts.  
It is separate from **Workflows** (company skill automations). Desk never publishes without approval. Provider failures fall back to a result that stays marked simulated and is not a live post. WhatsApp still sends only to `WHATSAPP_GROUP_OR_TO`.

## Stages

| Stage  | Artifact                         | Gate                         |
|--------|----------------------------------|------------------------------|
| Scout  | Research notes                   | Approve before Ghost         |
| Ghost  | Draft                            | Approve before Editor        |
| Editor | Voice / QA pass                  | Approve before Press         |
| Press  | Per-channel packs                | Approve before Clock         |
| Clock  | Schedule plan → Calendar items   | Approve before Echo          |
| Echo   | Reply drafts → Inbox items       | Approve files job to Library |

Skipping a gate is rejected by the API (`409`).

## Run locally

```bash
# from repo root
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

1. Sign in as Owner (`macnet@matos.local` / see README seed logins) or Author.
2. Open **Desk** in the sidebar.
3. **New brief** — topic, audience, offer/CTA, channels, due date.
4. Open the job → **Run stage** (uses OpenAI if `OPENAI_API_KEY` is set; otherwise deterministic placeholders).
5. Edit the artifact → **Save edits**.
6. As Operator/Owner → **Approve → next stage** (or Request changes).
7. After Clock approve, open **Calendar**. After Echo approve, open **Inbox** and **Library → Desk archive**.
8. Inbox actions: **Mark approved** / **Mark copied** only — no network send.

## RBAC

- **Author**: create briefs, run stages, edit artifacts (`desk:run`)
- **Operator / Owner**: also approve stages + inbox (`desk:approve`)
- **Viewer**: read-only

## Data

Prisma models: `DeskJob`, `DeskStageArtifact`, `DeskCalendarItem`, `DeskInboxItem` (SQLite).

## Not in this phase

Live Late publish, WhatsApp Cloud send, Etsy, GHL, ads, voice.
