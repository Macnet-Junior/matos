# Hick's law audit

Hick's law: the time to decide grows with the number and complexity of choices on screen. MatOS is run by one person, so each screen should make the usual next step obvious.

Audited in the browser at 1440×900, signed in as Owner (`macnet@matos.local`). Counts are interactive controls in the first viewport: links, buttons, disclosure summaries, inputs, selects, and textareas. Anything inside a closed disclosure is not counted. A long list that *is* the work (skills, knowledge files, a kanban card) is counted, and called out so it is not treated as chrome.

Rating:

- **OK** — one obvious next step, or the choices are the work itself.
- **minor** — a few peer actions that should sit behind More or a disclosure.
- **major** — a long row of equal choices, or the usual action is buried.

## Sidebar

The sidebar is on every Desk screen, so it dominated the count.

| | Before | After |
|---|---|---|
| Destinations | 25 links, about 18 of them in the first viewport. Support, Library, and the lower Ops links sat below the fold. | Same 25 destinations. 7 pinned, then five closed groups. |
| Extra control | A block labeled **PRIMARY ACTION** that was not a button. | **Accent**, closed. The swatch is not a button. |

Pinned, top to bottom: Home, Desk, Inbox, Calendar, Workflows, Skills, Knowledge.

Groups, closed until opened: Company, Records, Ops (Owner and Operator only), Support, Library. The group that contains the current page opens on its own. Nothing was removed.

On Home the viewport count went from 22 to 17. On an Ops page the count can rise by a few because that group is open and those links move into view. They used to be in the always-open list, often below the fold.

## Per screen

| Screen | Before | After | Main action | Rating | What changed, or why it was left |
|---|---:|---:|---|---|---|
| Login | 4 | 4 | Sign in | OK | Two actions. Email and password are already filled. Left as is. |
| Home | 22 | 17 | Open the next review | minor → OK | Sidebar. The pending gates are the work. |
| Company brief | 18 | 17 | Read | OK | Placeholder page. Sidebar only. |
| Company map | 30 | 28 | New skill | minor → OK | New department and Auto arrange are under More. Search, zoom, and the three skill tabs stay. They are the canvas. |
| Workbook | 18 | 17 | Read | OK | Placeholder. Sidebar only. |
| Repository | 18 | 17 | Read | OK | Placeholder. Sidebar only. |
| Workflows | 25 | 18 | Dry-run | minor → OK | The extra Open button is gone. The workflow name is already the link. |
| Workflow detail | 22 | 18 | Dry-run | minor → OK | Five gate pills became "step N of 5" plus All gates. Edit chain is under More. Advance stays next to Dry-run. |
| Skills | 41 | 35 | Open a skill | minor → OK | Export and Import are under Package. The rows are the list. |
| Knowledge | 35 | 25 | Open a file | minor → OK | Export and Import are under Package. "Linked from skills" starts closed. |
| Activity | 19 | 16 | Read the trail | OK | Download JSON stays the one action. |
| Publish & Channels | 22 | 19 | Connect that channel | OK | One connect action on each channel. Left as is. |
| Desk board | 20 | 15 | New brief | OK | The six columns are the board, not a menu. |
| Desk, new brief open | 39 | 24 | Create job | major → OK | LinkedIn and X stay out (they are the defaults). The other 11 channels are under More channels. |
| Desk job, Ghost ready to approve | 27 | 24 | Approve → next stage | major → OK | See below. The six stage chips were not buttons, but they read as six choices. |
| Desk job, Scout with no artifact | 26 | 21 | Run stage | major → OK | Run stage is the only stage button. |
| Calendar | 18 | 13 | Open the job | OK | No extra actions. A simulated badge is a status, not a choice. |
| Inbox | 18 | 13 | Mark approved | OK | Seed inbox is empty. On a draft, Mark approved stays the citron button and Mark copied stays beside it. |
| Ops home | 24 | 26 | Open a meter | minor, left | Six cards, each with a one-line description. The count rose because the Ops group is open here. |
| Ops feed | 27 | 24 | Read the feed | major → OK | All, Usage, and Workflows stay on the bar. Logins, Support, Auto-response, Credits, WhatsApp, and Publish are under More. |
| Presence | 18 | 20 | Read | OK | No actions. The open Ops group adds the links that used to sit lower in the sidebar. |
| Usage | 18 | 20 | Read | OK | Same as Presence. |
| Billing | 22 | 24 | Grant | OK | Grant is already the citron button. Adjust stays next to it. Both write a ledger row. |
| Content | 18 | 20 | Read | OK | Same as Presence. |
| Auto-response | 28 | 29 | Approve gate, or Enable once approved | minor → OK | Each rule shows one primary. Sim attempt (and Enable, while the gate is still pending) are under More. |
| Support tickets | 26 | 21 | Create ticket | minor → OK | Open / pending / solved is one Status select per ticket. |
| Support chat | 20 | 17 | Send | OK | One field and Send. |
| Library | 20 | 18 | Open a guide or the archive | OK | Two cards. |
| Encoding guide | 18 | 16 | Read | OK | A document. |
| Desk archive | 18 | 16 | Read a filed job | OK | A list. |
| Skillwright | 18 | 11 | Download folder | minor → OK | Insert replaces the four snippet buttons. Delete this draft is under More. Optional fields and Cursor fields were already disclosed. |

Skillwright's 18 included fields inside the closed Optional section (the browser still reports a size for them). What you could see was about 14. After, it is 11, and those optional fields stay closed.

### Desk job

Before, a Ghost job that was ready to approve showed six equal stage chips (Scout through Echo), then a Sources form with two full ways in (YouTube link **and** a transcript box, each with its own button), then Regenerate and Save as equal buttons. Approve sat under that. At 1440×900 the approve button was below the sources form.

After:

- One line, "Ghost · step 2 of 6", and a thin progress bar. All stages opens the list (current, approved, or waiting).
- **Approve → next stage** is the citron button. Request changes sits beside it. Save edits and Regenerate are under More.
- If the artifact has unsaved edits, Save edits becomes the citron button and Approve stays available. Approving still does not silently include unsaved text. That matches the old behavior.
- The review note starts closed under "Add a review note".
- Sources sits under the artifact. The YouTube link and **Turn this video into a skill** stay out. "Paste a transcript instead" opens the other path.

### Sources

There is no Pending / Processing / Failed / Done filter bar. Checked in the panel from PR #6 and on a live job. Each source is a row with a status badge: Pending, Processing, Failed, or Done. Failed rows still have Try again. The choice problem was the two intake forms shown at once, not a row of status tabs.

## Checklist for the next screen

- One citron button: the thing the person usually does next. If the screen is a list, the row is the choice and the chrome should not compete.
- A second action can sit beside it. Anything rarer goes under More. More must work from the keyboard (Enter, arrows, Escape).
- Do not add a destination to the pinned sidebar unless it is part of the daily loop. Put it in an existing group.
- Advanced or optional fields start closed.
- If there is a sensible default, show that and put the rest under More. Desk channels default to LinkedIn and X.
- Status filters: three on the bar, the rest under More. Do not add a filter tab for every status if a badge on the row is enough.
- A sequence (desk stages, workflow gates) is "step N of M", not a row of equal pills. Pills look like tabs.
- Count the first viewport before shipping. If the usual action is below the fold, move it up.
- A closed disclosure has to hide its contents. Do not rely on a `display` class inside `<details>` to do that.
- Name the control: a visible label, or `aria-label`. Toggle buttons use `aria-pressed`. The current page uses `aria-current="page"`.

## Noted, and what was done about it

- The sidebar accent said PRIMARY ACTION and was not a control. It is now a closed Accent swatch. Not a button.
- Desk stage chips and workflow gate pills looked like tabs and did not take the keyboard. They are a progress line plus a real disclosure.
- On the job page, Approve was below the sources form. The stage actions are now above Sources.
- Channel chips did not announce on/off. They use `aria-pressed`.
- The feed filter buttons did not announce which one was on. They use `aria-pressed`.
- Billing's credits and note fields, and the support chat field, had placeholders and no names. They now have `aria-label`s.
- The sidebar does not collapse to a drawer on a narrow window. Left as is. A drawer is a larger change than this pass.
- The map's zoom controls come from the canvas. Left as is.
