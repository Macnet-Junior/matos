# MatOS feature guide

This is a map of what MatOS can do today, and how to use each part.

You are the owner. You can open every page below. Sign in at [http://localhost:3040/login](http://localhost:3040/login). Click **Continue as Macnet Junior**. The password is `dev`.

A few words, used once:

- A **skill** is a saved recipe for one kind of work (for example, “write a hook”).
- A **knowledge file** is a note the company keeps, such as the brand voice. It lives under `knowledge/` in the project.
- **Evidence** is a link that shows where a claim came from.
- A **gate** is a stop. A person has to say yes before the work moves on.
- **Placeholder text** is stand-in writing. It is not a real draft from an AI.
- **Simulated** means a pretend post. It did not go live on the internet.

On the screen, the **Workspace** group is at the top of the sidebar. Under it, always visible, are Home, Desk, Calendar, and Inbox. This guide starts with that daily loop, then walks the rest of the sidebar from the top.

Anything marked **Not finished** is a shell. You can open it. It does not do the job yet.

## First 10 minutes

Do this loop once. It is the daily path.

1. Open [Home](http://localhost:3040/home). See if anything is waiting, and what happened last.
2. Open [Desk](http://localhost:3040/desk). Open the card **ICP pain → offer ladder post**.
3. Read the draft. If you click **Run stage**, the text you get is placeholder text unless an OpenAI key is set.
4. Open [Calendar](http://localhost:3040/calendar). Packs land here only after the Clock step is approved. A **simulated — not live** badge means it was not posted.
5. Open [Inbox](http://localhost:3040/inbox). Reply drafts land here after Echo. **Mark approved** does not send the reply.

Then, if you want to fix the company itself: Workspace → Company map → Content Studio → Brief Card → Evidence. Add a link. A normal web address such as `www.etsy.com/listing/123` should save. `https://` is added for you.

## Home

**What it’s for.** One place to see what is waiting on you.

**Where.** Sidebar **Home**. [http://localhost:3040/home](http://localhost:3040/home)

**How.**

1. Read **Pending review gates**. Each row is a workflow or a run that is still on draft or warm. Click it.
2. Read **Last run**. Click the name to open the practice-run log.
3. Read **Recent activity**. A row that names something is a link. Click it to open that thing (the seed note opens the company map). The line under the summary is plain words, such as “Workspace seeded”, not a code. A row with nothing behind it is not a link. **View all** opens the full trail.
4. Read **Channels**. It names Late.dev, Etsy, WhatsApp, Newsletter, and Blog, and it links to Publish & Channels.

**What you should see.** Three cards plus a channels line. With seeded data, you should see workflow names, a last run or a prompt to dry-run, and recent lines such as the seed note.

**Limits.** Home does not post anything. On a fresh setup the channels line says Late.dev, Etsy, WhatsApp, Newsletter, and Blog are not connected, and that publish stays simulated until one is. It does not say “Phase 4”. It never shows a delivery URL.

## Desk

**What it’s for.** Take one content idea from research to a filed piece, with a person saying yes at every step.

**Where.** Sidebar **Desk**. [http://localhost:3040/desk](http://localhost:3040/desk)

The six steps, in order:

1. **Scout** — research notes and angles
2. **Ghost** — first draft
3. **Editor** — voice and quality pass
4. **Press** — one pack per channel (X, LinkedIn, and so on)
5. **Clock** — put the packs on the calendar
6. **Echo** — draft replies, then file the job

**How.**

1. The board shows one column per step. Seeded cards: **ICP pain → offer ladder post** (on Ghost, waiting) and **Warm review ritual explainer** (on Scout).
2. Click a card. You land on a job page such as [http://localhost:3040/desk/desk-job-seed-1](http://localhost:3040/desk/desk-job-seed-1).
3. Click **Run stage** to write the current step. Edit the text. Click **Save edits**.
4. Click **Approve → next stage** to move forward, or **Request changes** to send it back. You can add a note.
5. To start fresh, click **New brief**. Fill title, due date, topic, audience, and “what should they do next”. Pick channels (LinkedIn and X are shown first; the rest are under More). If you turn on WhatsApp, the destination menu only lists approved numbers. Submit. You should open the new job.

**What you should see.** Six columns. A job page with the brief on the side, the draft in the middle, and one obvious next button. After a full Echo approval, the job is filed and shows up in Library → Desk archive.

**Limits.** Without `OPENAI_API_KEY`, **Run stage** writes placeholder text. The screen says so. Approving still works. Nothing posts to the internet from this page. A viewer can look but cannot start a brief or run a stage. Only an owner or operator can approve.

**Sources** on the job page are the YouTube-to-skill tool. See that section below.

## Calendar

**What it’s for.** See when Press packs are supposed to go out, without pretending a fake post went live.

**Where.** Sidebar **Calendar**. [http://localhost:3040/calendar](http://localhost:3040/calendar)

**How.**

1. Open the page.
2. Read the list by day. Click a pack to open its Desk job.
3. Look at the badge on each row.

**What you should see.** A short note that a simulated badge is not a live post. If nothing has been through Clock yet, you see: “No calendar items yet. Approve a job through Clock to place packs.”

**Limits.** There is no Post button here. Delivery is done by the scheduler (see below). Until a channel is really connected, deliveries are simulated and labeled **simulated — not live**.

## Inbox

**What it’s for.** Hold reply drafts so you can approve or copy them. It will not send them for you.

**Where.** Sidebar **Inbox**. [http://localhost:3040/inbox](http://localhost:3040/inbox)

**How.**

1. Open the page.
2. If a draft is there, read it.
3. Click **Mark approved** or **Mark copied**.

**What you should see.** The line “Not sent” on a draft, and a note that nothing is sent from this inbox. If Echo has not been approved yet, you see: “Inbox empty. Approve Echo on a Desk job to draft replies here.”

**Limits.** **Not a sender.** Mark approved only changes the label. It does not email, post, or message anyone.

## Workspace

Click **Workspace** at the top of the sidebar to open this group. Order: Company map, Workflows, Skills, Knowledge. Company brief, Workbook, and Repository are not in the sidebar. Opening those old addresses sends you to the company map.

### Company brief

**What it’s for.** There is no brief editor. The company lives on the map and in knowledge files.

**Where.** Not in the sidebar. [http://localhost:3040/brief](http://localhost:3040/brief) opens the company map.

**How.** Do not look for it under Workspace. Open Company map.

**What you should see.** The company map. Not a Phase 0 shell, and not a form for the mission.

**Not finished.** You cannot edit a brief on its own page. Use the Company map, and the knowledge files, for the live notes.

### Company map

**What it’s for.** See the company as departments and skills, and edit a skill without hunting through files.

**Where.** Workspace → **Company map**. [http://localhost:3040/map](http://localhost:3040/map)

A skill link looks like [http://localhost:3040/map?skill=brief-card](http://localhost:3040/map?skill=brief-card).

**How.**

1. The canvas loads with department bubbles. The counts at the top are departments, authored, planned, and missing sources.
2. Click a department to expand it. Content Studio holds Brief Card, Asset Pack, and the other content skills.
3. Click a skill. The right panel shows the title, owner, and review gate (Cold, Warm, or Hot — how hard a person must check it).
4. Tabs: **Instructions**, **Knowledge**, **Evidence**.
5. On Evidence, type a label and an address. Click **Add link**. A web address can omit `https://`. A knowledge file looks like `knowledge/brand/voice.md`.
6. **Edit skill** changes title, description, status, gate, purpose, instructions, steps, and knowledge paths. Click **Save**.
7. **New skill** (top right) adds a skill. The overflow menu (the extra button) has **New department** and **Auto arrange**. Those two are owner-only.
8. Search is the box on the canvas. Ctrl+K or ⌘K focuses it.

**What you should see.** The skill stays selected after a save. A new evidence link shows the label and the address. A bad address shows a sentence that names the field, such as “Evidence link 2 address must be a web link…”. It should not only say “Validation failed”.

**Limits.** **Run skill** does not run anything. It shows a short note that the skill was queued and that this does nothing until workflows. The company bubble says “Phase 2 · Knowledge”. That label is fixed text, not a live status.

### Workflows

**What it’s for.** Chain skills in order and practice the chain before anything could publish.

**Where.** Workspace → **Workflows**. [http://localhost:3040/workflows](http://localhost:3040/workflows)

**How.**

1. You should see two seeded chains: **Research → Hook → Caption → Calendar** and **Hook → Short Script → Calendar**.
2. Click **Dry-run** on a row. You go to a run page such as [http://localhost:3040/workflows/runs/…](http://localhost:3040/workflows).
3. Read the step log. An owner or operator can move the gate (draft → warm → approved → scheduled → published).
4. Click a workflow name to edit its name, description, and skill order. **New workflow** is owner-only.

**What you should see.** The page says dry-run only, no external posts. The run page says publish is simulated only after approval.

**Limits.** A practice run does not post. It does not call your social accounts.

### Skills

**What it’s for.** A table of every skill, so you can find one and jump to it on the map.

**Where.** Workspace → **Skills**. [http://localhost:3040/skills](http://localhost:3040/skills)

**How.**

1. Scan the table. Slug, title, department, status, gate.
2. Click a slug. You land on that skill on the map.
3. Open **Package**. **Export JSON** downloads the skills. **Import JSON** updates matching skills and adds new ones. It does not delete the others.

**What you should see.** About 33 skills. Authored ones are the ones with instructions and real knowledge files. Planned means “not written yet”. Missing means a knowledge or evidence file path is broken.

**Limits.** You do not edit the skill on this page. Editing is on the map.

### Knowledge

**What it’s for.** Read and swap the company’s notes (brand voice, offers, support answers) without losing the link to the skill that uses them.

**Where.** Workspace → **Knowledge**. [http://localhost:3040/knowledge](http://localhost:3040/knowledge)

A single file looks like [http://localhost:3040/knowledge?path=knowledge%2Fbrand%2Fvoice.md](http://localhost:3040/knowledge?path=knowledge%2Fbrand%2Fvoice.md).

**How.**

1. Click a file in the list. The note renders on the right.
2. If a skill uses that file, you see the skill name.
3. **Export ZIP** / **Import ZIP** (owner or author) packs the notes.

**What you should see.** Files such as brand voice, mix ratios, and the support FAQs. The preview is the note, not raw code.

**Limits.** This is the real note library. The old Repository address opens the company map. It is not a second library.

### Workbook

**What it’s for.** There is no project list. Active work is on Desk and Workflows.

**Where.** Not in the sidebar. [http://localhost:3040/workbook](http://localhost:3040/workbook) opens the company map.

**How.** Do not look for it under Workspace.

**What you should see.** The company map. Not a Phase 0 shell.

**Not finished.** There is no project list yet.

### Repository

**What it’s for.** There is no separate canon tree. Notes live under Knowledge.

**Where.** Not in the sidebar. [http://localhost:3040/repository](http://localhost:3040/repository) opens the company map.

**How.** Do not look for it under Workspace. Open Knowledge for the notes.

**What you should see.** The company map. Not a Phase 0 shell.

**Not finished.** The live notes are under Knowledge.

## Records

Click **Records** in the sidebar.

### Activity

**What it’s for.** A trail of what changed: map edits, workflow runs, desk actions.

**Where.** Records → **Activity**. [http://localhost:3040/activity](http://localhost:3040/activity)

**How.** Scroll the list. Click a row that names something to open it. An owner can click **Download JSON**.

**What you should see.** The newest events first, up to 100. Each line has a short summary and plain words for what happened, not a dotted code. A row with nothing to open is not a link.

**Limits.** It records. It does not undo.

### Channels (this is the settings page)

**What it’s for.** See which posting accounts are really connected, and which paths are still pretend.

**Where.** Records → **Channels**. There is no separate Settings group. [http://localhost:3040/settings/channels](http://localhost:3040/settings/channels)

The page title is **Publish & Channels**.

**How.**

1. Open the page. Read each provider card: Late (social), Etsy, WhatsApp, Newsletter, and Blog.
2. A connected provider needs keys in the env file, and for Etsy a sign-in handshake. The owner can start those connects. Do not paste secrets into chat.
3. Newsletter is live when `NEWSLETTER_DELIVERY_URL` is set. Blog is live when `BLOG_DELIVERY_URL` is set. The card says **Live-configured** or **Simulated**. If a URL is set, the card may show the host (for example `127.0.0.1:3099`). It does not show the path, the query, or a password in the URL.
4. The WhatsApp card lists approved destinations. Numbers are masked. It says live-configured or simulated. There is no way to message anyone else.
5. The sidebar footer **Accent** only shows the citron color `#D6F31F`. It does not change settings.

**What you should see.** A line that says without keys, publish paths stay simulated. Newsletter and Blog cards are on the page, next to Late.dev, Etsy, and WhatsApp. Cards should not claim a live account if none is connected. A live newsletter or blog card says Live-configured and, at most, the delivery host. The WhatsApp card shows a count of approved destinations and masked numbers.

**Limits.** With a fresh seed, channels are not connected. Calendar and the scheduler will say simulated until a provider is live. WhatsApp may message only the approved list in `WHATSAPP_ALLOWED_TO` (comma-separated, optional `label|number`, at most 10). `WHATSAPP_GROUP_OR_TO` still works as a single destination and is the default when a post does not name one. The WhatsApp card shows how many destinations are configured, masks each number (for example `+237••••12`), and says `live-configured` or `simulated`. A number that is not on the list is rejected and not sent. There is no option to message anyone.

## Ops

**What it’s for.** See who is here, what the system spent, and whether auto-replies are allowed.

**Where.** Sidebar **Ops**. Only the owner and an operator see this group. Anyone else who opens the URL is sent back to Home.

[http://localhost:3040/ops](http://localhost:3040/ops)

**How.**

1. **Ops home** shows who is online and links to the rest.
2. **Feed** ([http://localhost:3040/ops/feed](http://localhost:3040/ops/feed)) is a live list. It refreshes every few seconds. Filters: All, Usage, Workflow, and More (logins, support, auto-response, credits, WhatsApp, publish).
3. **Presence** ([http://localhost:3040/ops/presence](http://localhost:3040/ops/presence)) lists people, the page they are on, and online or away. The app pings about every 30 seconds while you are in it.
4. **Usage** ([http://localhost:3040/ops/usage](http://localhost:3040/ops/usage)) is the last 30 days of meters: AI credits, Late posts, Etsy calls, WhatsApp sends, API hits.
5. **Billing** ([http://localhost:3040/ops/billing](http://localhost:3040/ops/billing)) shows a credit balance and a ledger. The badge says **Stripe disabled**. No card is charged. An owner can adjust the local credit grant.
6. **Content** ([http://localhost:3040/ops/content](http://localhost:3040/ops/content)) counts publication outcomes. Simulated deliveries are counted apart from live ones.
7. **Auto-response** ([http://localhost:3040/ops/auto-response](http://localhost:3040/ops/auto-response)) holds reply rules. A rule must be approved before it can be turned on. **Sim attempt** tries a rule without sending.

**What you should see.** An online count on Ops home. Seeded usage rows, a credit balance, and at least one auto-response rule.

**Limits.** Billing is a local ledger, not Stripe. Auto-response does not message customers until a rule is approved and a channel is actually live. Content here is a scoreboard, not the editor. The editor is Desk.

## Support

### Tickets

**What it’s for.** Write down a problem so it is not stuck in a chat.

**Where.** Support → **Tickets**. The page title is Support center. [http://localhost:3040/support](http://localhost:3040/support)

**How.**

1. Read the open tickets. Seed data includes one.
2. Create a ticket with the form.
3. As owner, you can change its status.
4. FAQ links open the matching note in Knowledge.

**What you should see.** The ticket list and the FAQ links under `knowledge/support/`.

### Chatbot

**What it’s for.** Answer a common question from the FAQ notes, and open a ticket when the question is about money or a refund.

**Where.** Support → **Chatbot**. [http://localhost:3040/support/chat](http://localhost:3040/support/chat)

**How.** Type a question such as “how do credits work?” Send it.

**What you should see.** An answer that points at a knowledge note. It should not invent a refund.

**Limits.** Without `OPENAI_API_KEY`, this is a keyword match on the FAQ files, not a free-form AI. The page says that.

## Library

**What it’s for.** House guides, plus finished Desk jobs.

**Where.** Sidebar **Library**. [http://localhost:3040/library](http://localhost:3040/library)

**How.**

1. Open Library. Two cards: Encoding guide and Desk archive.
2. **Encoding guide** ([http://localhost:3040/library/encoding-guide](http://localhost:3040/library/encoding-guide)) checks every skill for a purpose, steps, a review gate, and at least one knowledge link. Click a slug to open that skill on the map.
3. **Desk archive** ([http://localhost:3040/library/desk](http://localhost:3040/library/desk)) lists jobs filed after Echo. Click one to open it. Empty until you finish a job.

**What you should see.** Pass and fail counts on the encoding guide. Planned skills fail the “authored” bar until they have instructions and real knowledge files. That is expected.

## YouTube-to-skill (Sources)

**What it’s for.** Turn a public YouTube video, or a pasted transcript, into a draft skill and a grade of the talk (hook, loop, pillars).

**Where.** Not its own sidebar item. Open any Desk job. The **Sources** box is on that page.

**How.**

1. Open a Desk job.
2. Paste a YouTube link. Click **Turn this video into a skill**.
3. Or paste a transcript (lines can start with `[00:00]`) and click **Use this transcript**.
4. If it fails, read the reason and click **Try again**.

**What you should see.** When it works: a draft skill and a grade. The draft is not turned on and it is not watched. You can show the draft skill file.

**Limits.** This needs `GEMINI_API_KEY` in `apps/web/.env.local`. Google bills that key. MatOS does not. If the key is missing, the box tells you to add it and restart Desk. You do not start the separate Skillwright app for this. Desk calls that code itself.

## Skillwright

**What it’s for.** Write a `SKILL.md` file an agent can find and follow, in a separate editor.

**Where.** Not in the MatOS sidebar. It is its own app. From the project folder run `pnpm dev:skillwright`, then open [http://localhost:43123](http://localhost:43123).

**How.**

1. Start from a template or a blank skill.
2. Write the instructions. Use the Checks panel.
3. **Copy SKILL.md** or download the folder.

**What you should see.** The line “Write a skill an agent can discover and follow.” Panels for writing, the file, and checks.

**Limits.** Drafts stay in this browser (local storage). They are not saved into the MatOS company map. Closing the browser on another computer will not have them. This app has its own sign-in story: it does not use the MatOS login.

## Content engine

**What it’s for.** A full editorial engine (one place that plans, writes, and measures every piece) is the direction. It is not a screen today.

**Where.** There is no Content Engine item and no `/content-engine` page.

**What you can use now.**

- Desk, to make the piece.
- Workflows, to practice a skill chain.
- Ops → Content, to see counts after something is delivered.

**Not finished.** Do not look for a Content Engine button. It is not there.

## Scheduler

**What it’s for.** When a calendar item is due, and Clock was approved, try to deliver it once. Then read newsletter and blog posts back, so a scheduled delivery can finish after the process that posted it has exited.

**Where.** There is no scheduler button. It is a command, run from the project folder:

```bash
pnpm --filter web desk:schedule
```

On the owner’s ThinkPad, Windows Task Scheduler runs that command every 5 minutes.

**How.** Approve a job through Clock so a calendar item exists. Connect a channel if you want a live post. For newsletter or blog, set `NEWSLETTER_DELIVERY_URL` or `BLOG_DELIVERY_URL` (the ThinkPad test receiver is `http://127.0.0.1:3099/deliver`). Run the command. Read the JSON it prints: considered, delivered, skipped, failed, and a `reconcile` object (considered, settled, stillOpen).

Each run does two passes, then exits. The first starts deliveries that are due. The second asks the delivery URL how scheduled newsletter and blog posts turned out, and moves the calendar row off `planned` when the answer is published or failed.

The delivery contract, for a receiver you run yourself:

- POST `{ "channel", "idempotencyKey", "externalId", "state" }`. For a Desk item, `idempotencyKey` is `desk-calendar:<itemId>` and `externalId` is `newsletter_desk-calendar:<itemId>` or `blog_desk-calendar:<itemId>`. `state` is `scheduled` or `published`.
- GET the same URL with `idempotencyKey` set to that same posted key. The reply is `{ "status": "published" | "failed" | "scheduled" | "pending" }`.
- A receiver that stored the prefixed `externalId` instead of the posted key still matches. The read tries the posted key first, then the prefixed id.

**What you should see.** A one-time result in the terminal. Items that are not due, not approved, or already attempted are skipped. Without live channel keys, a delivery is simulated and stays labeled that way. A live newsletter or blog post stays in flight until the receiver says published or failed. When it does, the calendar row leaves `planned`.

**Limits.** The Desk app does not run this on a timer by itself. Something outside the app (a schedule on the machine) has to call it. Running it twice should not send the same post twice. A run that only re-checks work it already handled does not add a row to Activity or Home. A run that delivers, fails, repairs a calendar row, or settles a read-back does.

## Who can do what

| Person | Sign-in | Can |
| --- | --- | --- |
| Owner (you) | macnet@matos.local | Everything above, including Ops and approves |
| Operator | operator@matos.local | Run and approve Desk and workflows, see Ops. Cannot edit the map. |
| Author | author@matos.local | Edit skills, run Desk stages. Cannot approve. No Ops. |
| Viewer | viewer@matos.local | Look around. Support tickets and chat. Very little else. |

Password for all of these in local dev is `dev`.
