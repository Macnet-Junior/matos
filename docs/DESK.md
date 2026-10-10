# Relay Desk (Phase 5.5)

Desk is the MatOS **newsroom** mode: brief → six gated stages → calendar packs → inbox reply drafts.  
It is separate from **Workflows** (company skill automations). Desk never publishes without approval. Provider failures fall back to a result that stays marked simulated and is not a live post. WhatsApp sends only to the approved list (`WHATSAPP_ALLOWED_TO`, with `WHATSAPP_GROUP_OR_TO` kept as the default).

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

## Sources (YouTube → draft skill)

Open a job. Under **Sources**:

1. Paste a public YouTube link and choose **Turn this video into a skill**, or paste a transcript (lines may start with `[mm:ss]`) and choose **Use this transcript**. The transcript path is the same draft and the same grade, for when Gemini cannot read the video. A YouTube address pasted into the transcript box is still treated as a YouTube source.
2. The row shows **YouTube** and **Processing** right away. Skillwright asks Gemini in the background (`GEMINI_API_KEY` in `apps/web/.env.local`, or a user env var). Google bills that key. MatOS does not. The read sends the public YouTube address the same way a direct Gemini call does (`fileData.fileUri` plus the question). It does not set media resolution or a frame rate. A normal video usually finishes in a couple of minutes. The call is allowed about ten minutes. The page keeps checking until the row leaves Processing. If Gemini rejects an option on that request, Skillwright retries once without it. A failure prints Gemini's HTTP status and message in the Desk server log. The key is not in that line.
3. **Done** shows the draft skill and the grade (hook, then loop, then pillars). The draft is not turned on and it is not watched. Code execution and file creation stay off.
4. **Failed** shows a plain reason and **Try again**. Nothing from that reply is saved as a skill. A video longer than about an hour should be pasted as a transcript instead. If the key is missing, the panel says to add `GEMINI_API_KEY` to `apps/web/.env.local` and restart Desk. A bad link or an oversized paste says what is wrong, not "Validation failed".

`GEMINI_MODEL` is optional. The default is `gemini-3.8-flash`, which accepts a YouTube URL directly.

On the ThinkPad, Desk is usually [http://localhost:3040](http://localhost:3040):

```bash
pnpm --filter web exec next dev -p 3040
```

`pnpm dev` from the repo root still uses port 3000.

## Not in this phase

Live Late publish, WhatsApp Cloud send, Etsy, GHL, ads, voice.
