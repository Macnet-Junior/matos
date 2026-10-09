# MatOS — Design Brief

**Document 4 of 6.** Product requirement → technical requirement → app flow → **design brief** → schema → implementation plan.

**Status:** written 2026-10-09. Every value below is read from `packages/ui/tokens.css` and `packages/ui/tailwind-preset.ts` — the implementation is the source of truth, and where this document and the code disagree, the code is right.

---

## 1. What this document is for

Document 3 said how a person moves through MatOS. This says what it looks like while they do, and — more usefully — **why**. A palette can be copied from the tokens file in ten seconds; the decisions that constrain a new screen are not in the file, so they are here.

The intended reader is whoever builds the next surface. `/design` is the live reference; this is the reasoning behind it.

---

## 2. The idea

MatOS presents a company as a **place**. The map is the clearest expression — seven departments around a centre node, navigable — but it is the whole product's stance, not one screen's feature.

Two consequences that decide most visual questions:

**The product should look like an instrument, not a document.** MatOS runs processes and reports state. Dark, dense, monospaced where a number matters. It is closer to a terminal that happens to have a graph than to a writing app.

**The owner's own words are the most valuable thing on screen.** The Desk's output is only worth reading if it is traceable back to something the owner actually said. So when a transcript, a grade, or a source appears, it is the visual centre — not a summary of it, not a collapsed panel.

---

## 3. Colour

**Accent: Citron Volt `#D6F31F`.** Hover `#E8FF5A`, pressed `#B8D110`, dim `rgba(214,243,31,0.14)`, glow `rgba(214,243,31,0.35)`.

Citron is a **state** colour, not a decoration colour. It means: this is active, this is actionable, this is the primary path. It appears on at most one primary action per screen and on the active nav item — nowhere else. The sidebar's active state is the exact pattern to follow: a dim citron wash, a 2px inset left bar, and a 6px glowing dot.

**Surface stack, dark, three levels:**

- `#0b0c0e` page background
- `#12141a` elevated — the sidebar, and anything that sits above the page
- `#161922` panel — cards, table rows, contained regions

**Borders** divide rather than outline: `#2a2e3a` for a real boundary, `#1e222d` for a soft one. A border should be the last thing you notice.

**Text:** `#f2f3f5` primary, `#8b93a7` muted (labels, secondary), `#5c657a` muted2 (disabled, nav section headers).

**Danger: `#f07178`.** Failures, destructive actions, and failing checks. Note the restraint: a failing check is marked in danger, but it is *not* thrown away in a red block — a correction the owner is meant to act on should read as a finding, not an alarm.

**Gap:** there is no success colour and no warning colour. Two states the product needs constantly — "this passed" and "this is degraded" — are currently expressed by leaving citron off, which is a silence, not a signal. Recommendation: a single desaturated green for pass and amber for degraded, used with the same restraint as danger. Do not ship this without deciding it deliberately; it is the kind of addition that quietly becomes the fourth accent colour.

---

## 4. Type

One family: `Segoe UI`, `Helvetica Neue`, system sans. Nothing is loaded — no webfont, no network dependency for type. That is a constraint worth keeping: MatOS must look identical before and after a deploy.

**Sizes and what each is for:**

- **30px bold** — page title, once per screen. `/home` uses it in citron; interior pages use it plain, because home is the identity surface and the others are working surfaces.
- **24px bold** — a section that stands alone within a page.
- **15px** — the product name, and nothing else.
- **13px** — nav items, table body, the default working size. Most text in MatOS is 13px, and that is intentional: dense.
- **11–12px** — labels, metadata, the mono figures.
- **10px uppercase, `0.08em` tracking** — nav section headers. The only uppercase in the product.

**Mono** (`ui-monospace`, `SF Mono`, Menlo, Consolas) is reserved for things that are exactly what they say: token values, timestamps, ids, credit counts. `#D6F31F` in the sidebar is mono because it is a literal value. A timestamp beside a transcript segment is mono for the same reason. Mono is not a style choice; it is a claim that the string is not prose.

---

## 5. Space and shape

Nothing exotic, and the consistency is the point.

- Radius: **7px** small (logo mark), **8px** nav and buttons, **10px** panels, **12px** large containers.
- Sidebar: fixed **232px**, `px-3.5` / `py-[18px]`, `gap-5` between sections.
- Nav item: `px-2.5 py-2`, `gap-2.5`, dot 6px.
- Gaps: `0.5` within a group, `5` between groups, `3` inside a panel.

The rule: **spacing grows with containment.** Elements inside a panel are tight; panels are separated generously. A screen that feels crowded is almost always a containment problem, not a spacing-value problem.

---

## 6. Motion

Almost none, and deliberately. The one animation that exists is the accent glow — `0 0 24px rgba(214,243,31,0.35)` — used on the active nav dot and on citron primary actions. It reads as *live*, which is what the map and the presence heartbeat are about.

**Gap:** there is no motion spec — no durations, no easing, no rule for transitions between stages. Since the Desk advances through six stages, a transition that made "the job moved" legible would earn its place. Until specified, keep it to the glow and colour/opacity transitions, and do not add movement.

---

## 7. Components in use

What exists and therefore what a new screen should reuse.

**`Sidebar`** — the reference implementation of the accent system. Copy its nav item exactly.
**`DeskBoard`**, **`DeskJobDetail`**, **`DeskCalendar`**, **`DeskInbox`** — the four Desk surfaces.
**`CompanyMap`** / `MapShell` — React Flow, dark, overridden in `globals.css` (controls `#161922`, minimap `#12141a`, background transparent).
**`MarkdownView`** — how artifacts render. Artifacts are markdown, so this is the default reading surface for anything the Desk produces.
**`RunTrace`** — how a multi-step run is shown.
**`KnowledgeBrowser`**, **`WorkflowsPanel`**, **`WorkflowDetail`**, **`SkillsPackageActions`**, **`ChannelsPanel`**, **`ActivityExportButton`**, **`PresenceHeartbeat`**.

**Gap:** there is no shared component for the two things the product most needs to show — **a gated artifact awaiting a decision**, and **a finding with a sentence and a timestamp**. Both are built ad hoc per surface. Document 5's `DeskStageArtifact` and the grading output are the data; the missing piece is a component that renders either one consistently. That component is the single highest-value addition to `packages/ui`, because it is what makes the gate and the grade readable at a glance instead of only on inspection.

---

## 8. Non-negotiables

These are product claims expressed visually. A screen that violates one is wrong regardless of how it looks.

**A simulated result always looks simulated.** Never a live-post treatment, never a silent fallback. The label is part of the design, not a debug annotation.

**Nothing sends without approval.** No send button, no optimistic "sent" state anywhere. The Inbox has no `sent` status because the product has no send.

**Refusal is rendered, not hidden.** When a check cannot run, when a source produced no speech, when a provider is missing — the screen says so with its reason. An empty state that reads like a passing state is the most dangerous visual in the product.

**A finding carries its evidence.** If a screen says something is wrong, the failing sentence and its timestamp are on that screen. A verdict without evidence is advice, and advice is what the owner can already get from any model.

---

## 9. Adding a screen

The checklist, in order:

1. Which flow does this belong to, and where does the user arrive from — document 3.
2. One page title at 30px, plain (citron only on `/home`).
3. Citron on exactly one primary action, or none.
4. Text at 13px unless it is a title, a label, or a mono value.
5. Panel on page background on elevated background — pick the level by containment, not by taste.
6. If it shows a result, decide first what it looks like when the result is *refused*.
7. If it shows a finding, the evidence goes on the same screen.
8. Reuse an existing component before building one — and if you build one, check section 7's gap first.

---

## 10. Where this is incomplete

Stated plainly so the document is not mistaken for finished.

- **No success or warning colour.** Section 3. A real decision, not an oversight.
- **No motion spec.** Section 6.
- **No component for the artifact-decision or finding-with-evidence pattern.** Section 7 — the most consequential gap, because it is the two things the Desk does most.
- **No responsive specification.** MatOS is a desktop instrument today; the sidebar is fixed at 232px and the shell is `h-screen` with no breakpoint work. If it is ever used on a phone this is the first thing that breaks.
- **No empty-state catalogue.** Section 8 makes refusal a design obligation; there is no set of patterns for it yet.
