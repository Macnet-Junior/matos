# MatOS test checklist

Use this with [MATOS-FEATURE-GUIDE.md](./MATOS-FEATURE-GUIDE.md).

Sign in at [http://localhost:3040/login](http://localhost:3040/login) as Macnet Junior (password `dev`) unless a line says otherwise.

Reply in one message. One line per test:

`DESK-3 ❌ save button did nothing`

`HOME-1 ✅`

If a step does not apply, write `skip` and why: `CAL-2 skip no calendar items yet`.

## Tests

LOGIN-1 Open http://localhost:3040/login, click Continue as Macnet Junior, and you should land in the app (the map is fine).

HOME-1 Open Home and you should see Pending review gates, Last run, and Recent activity, not a blank page.

HOME-2 On Home, Last run should show a workflow name or the line that says no runs yet and points at Workflows.

HOME-3 On Home, the Channels line should say Late.dev, Etsy, and WhatsApp are not connected, with a link to Publish & Channels. It should not say Phase 4.

HOME-4 On Home, click the recent activity row for the seed note. It should open the company map. The line under the summary should be plain words such as Workspace seeded, not a code like seed.

DESK-1 Open Desk and you should see six columns: Scout, Ghost, Editor, Press, Clock, Echo.

DESK-2 Open the card ICP pain → offer ladder post and you should see the brief and a Ghost draft.

DESK-3 On that job, click Run stage and you should get new text. Without an OpenAI key it is placeholder text, and the page should say so.

DESK-4 Change a few words in the draft and click Save edits. Reload the job and your words should still be there.

DESK-5 You should see Approve → next stage and Request changes. Do not have to finish every stage.

DESK-6 Click New brief, fill topic, audience, and offer, pick a channel, and submit. A new job page should open.

CAL-1 Open Calendar. You should see the schedule page, or the line that no items exist until Clock is approved.

CAL-2 If a pack is listed, a pretend post must say simulated — not live. There should be no button that claims it already went live.

INBOX-1 Open Inbox. You should see reply drafts, or the line that Echo has to be approved first.

INBOX-2 If a draft is there, click Mark approved. The page should still say nothing is sent. Nothing should be emailed or posted.

BRIEF-1 Company brief should not be in the sidebar. Open http://localhost:3040/brief and you should land on the company map, not a Phase 0 shell.

MAP-1 Open Company map. You should see department bubbles and counts for authored, planned, and missing.

MAP-2 Open Content Studio, click Brief Card, and the right panel should show Brief Card with Instructions, Knowledge, and Evidence.

MAP-3 On Evidence, add label Offer page and address www.etsy.com/listing/123, then click Add link. The link should appear and stay after a reload. The address should start with https://.

MAP-4 On Evidence, add label Note and address not a link. The red text should name the evidence address and say it must be a web link or a knowledge file. It should not only say Validation failed. The words you typed should stay in the boxes.

MAP-5 Click Edit skill, change the purpose, click Save. The panel should show the new purpose.

MAP-6 Click Run skill. You should only get a short note that nothing runs yet. The page should not pretend the skill ran.

WF-1 Open Workflows. You should see Research → Hook → Caption → Calendar and Hook → Short Script → Calendar, and a line that this is a practice run with no external posts.

WF-2 Click Dry-run on one workflow. A run page should open with a step log, not a live post.

SKILL-1 Open Skills. You should see a table of skills. Click brief-card and you should land on that skill on the map.

SKILL-2 On Skills, open Package. Export JSON should download a file. You can skip Import if you do not want to change skills.

KNOW-1 Open Knowledge and click the brand voice file. You should see the note, not an error.

BOOK-1 Workbook should not be in the sidebar. Open http://localhost:3040/workbook and you should land on the company map, not a Phase 0 shell.

REPO-1 Repository should not be in the sidebar. Open http://localhost:3040/repository and you should land on the company map, not a Phase 0 shell.

ACT-1 Open Records → Activity. You should see a list of events, newest first, or a clear empty state. A row that names something should be a link. The action should be plain words, not a dotted code.

CHAN-1 Open Records → Channels (page title Publish & Channels). It should say that without keys, publish stays simulated. It should not show a live connected account on a fresh setup. The WhatsApp card should say how many approved destinations are configured, mask numbers (never the full number), and say simulated rather than live-configured when WhatsApp is not keyed.

OPS-1 Open Ops. You should see an online count and links to Feed, Presence, Usage, Billing, Content, and Auto-response.

OPS-2 Open Feed. The list should show events and the filter buttons. It should keep itself updated.

OPS-3 Open Presence. You should see your email as online, or a clear empty state if the ping has not landed yet.

OPS-4 Open Usage. You should see meters for the last 30 days (AI, Late, Etsy, WhatsApp, or API hits).

OPS-5 Open Billing. You should see a credit balance and a Stripe disabled badge. No card form should charge you.

OPS-6 Open Ops → Content. You should see publication counts, with simulated kept apart from live. An empty delivery list is ok.

OPS-7 Open Auto-response. You should see at least one seeded rule, and you should not be able to turn a rule on before it is approved.

SUP-1 Open Support → Tickets. You should see the support center and a way to create a ticket. The seeded ticket should be listed.

SUP-2 Open Support → Chatbot and ask how credits work. You should get an answer that points at a help note, not a made-up refund.

LIB-1 Open Library. You should see cards for Encoding guide and Desk archive.

LIB-2 Open Encoding guide. You should see pass and fail counts and a row per skill. Clicking a slug should open that skill on the map.

LIB-3 Open Desk archive. You should see filed jobs, or a clear empty state if you have not finished Echo.

YT-1 On a Desk job, find Sources. Without a Gemini key, it should tell you to add GEMINI_API_KEY. Do not paste a key into the chat. If a key is set, a YouTube link or pasted transcript should return a draft skill and a grade, or a plain failure with Try again.

SW-1 Skillwright is separate. From the project folder run pnpm dev:skillwright and open http://localhost:43123. You should see the skill editor. A draft there should not appear on the Company map by itself. Skip if you cannot start a second app.

ENG-1 Look through the sidebar. There should be no Content Engine item. Ops → Content is only the scoreboard.

SCHED-1 There should be no scheduler button in the app. From the project folder, pnpm --filter web desk:schedule should print a JSON result and exit. Skip if you are not in a terminal.

## Notes

Write anything that does not fit a line above.

## Report template

Copy this block, fill the blank after each id, and send it back.

```
LOGIN-1 
HOME-1 
HOME-2 
HOME-3 
HOME-4 
DESK-1 
DESK-2 
DESK-3 
DESK-4 
DESK-5 
DESK-6 
CAL-1 
CAL-2 
INBOX-1 
INBOX-2 
BRIEF-1 
MAP-1 
MAP-2 
MAP-3 
MAP-4 
MAP-5 
MAP-6 
WF-1 
WF-2 
SKILL-1 
SKILL-2 
KNOW-1 
BOOK-1 
REPO-1 
ACT-1 
CHAN-1 
OPS-1 
OPS-2 
OPS-3 
OPS-4 
OPS-5 
OPS-6 
OPS-7 
SUP-1 
SUP-2 
LIB-1 
LIB-2 
LIB-3 
YT-1 
SW-1 
ENG-1 
SCHED-1 
```
