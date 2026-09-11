import type { DeskStage } from "./stages";
import { STAGE_LABELS } from "./stages";

export type DeskBriefInput = {
  title: string;
  topic: string;
  audience: string;
  offerCta: string;
  channels: string[];
  dueAt: string | null;
};

export type DeskGenerateInput = {
  stage: DeskStage;
  brief: DeskBriefInput;
  priorArtifacts: { stage: string; title: string; body: string }[];
};

export type DeskGenerateResult = {
  title: string;
  body: string;
  meta: Record<string, unknown>;
};

export interface DeskLlmProvider {
  generate(input: DeskGenerateInput): Promise<DeskGenerateResult>;
}

function channelList(channels: string[]): string {
  return channels.length ? channels.join(", ") : "general";
}

function priorBlock(
  prior: DeskGenerateInput["priorArtifacts"],
  stage: string,
): string {
  const hit = prior.find((p) => p.stage === stage);
  if (!hit) return "(none yet)";
  return hit.body.slice(0, 1200);
}

/** Deterministic high-quality placeholders when OPENAI_API_KEY is absent. */
export class PlaceholderDeskProvider implements DeskLlmProvider {
  async generate(input: DeskGenerateInput): Promise<DeskGenerateResult> {
    const { stage, brief } = input;
    const channels = channelList(brief.channels);
    const label = STAGE_LABELS[stage];

    switch (stage) {
      case "scout":
        return {
          title: `Scout notes — ${brief.topic}`,
          body: [
            `# Scout · Research notes`,
            ``,
            `**Topic:** ${brief.topic}`,
            `**Audience:** ${brief.audience}`,
            `**Offer / CTA:** ${brief.offerCta}`,
            `**Channels:** ${channels}`,
            brief.dueAt ? `**Due:** ${brief.dueAt}` : `**Due:** unset`,
            ``,
            `## Signals`,
            `- Audience friction: ${brief.audience} still stitch tools by hand.`,
            `- Competitive gap: few operators ship gated newsroom pipelines.`,
            `- Proof angle: human approve-gates beat spray-and-pray calendars.`,
            ``,
            `## Angle shortlist`,
            `1. "${brief.topic}" as an operating problem, not a content tip.`,
            `2. Map the brief → artifact → approve loop in plain language.`,
            `3. Land on ${brief.offerCta}.`,
            ``,
            `## Sources to cite (stub)`,
            `- Internal brand voice / offer ladder`,
            `- Prior Warm-review wins from Workflows`,
            `- Desk dry-run placeholders (no live web scrape in Phase 5.5)`,
          ].join("\n"),
          meta: { provider: "placeholder", stage },
        };
      case "ghost":
        return {
          title: `Ghost draft — ${brief.title || brief.topic}`,
          body: [
            `# Ghost · Draft`,
            ``,
            `**Working title:** ${brief.title || brief.topic}`,
            ``,
            `## Hook`,
            `${brief.topic} is not a posting problem — it is a desk problem.`,
            ``,
            `## Body`,
            `If you are ${brief.audience.toLowerCase()}, you already know the pattern:`,
            `briefs stall, drafts rot, and calendars fill with almost-ships.`,
            ``,
            `MatOS Desk runs six stages with a human gate on each:`,
            `Scout → Ghost → Editor → Press → Clock → Echo.`,
            ``,
            `## Close`,
            `${brief.offerCta}`,
            ``,
            `## Notes from Scout`,
            priorBlock(input.priorArtifacts, "scout"),
          ].join("\n"),
          meta: { provider: "placeholder", stage },
        };
      case "editor":
        return {
          title: `Editor pass — voice & QA`,
          body: [
            `# Editor · Voice & QA`,
            ``,
            `## Voice check`,
            `- Cut filler; keep operator-precise tone.`,
            `- Audience: ${brief.audience}`,
            `- CTA stays concrete: ${brief.offerCta}`,
            ``,
            `## QA checklist`,
            `- [x] Hook earns the stop`,
            `- [x] One idea per section`,
            `- [x] Channels considered: ${channels}`,
            `- [ ] Facts flagged as stub (no live scrape)`,
            ``,
            `## Edited throughline`,
            `Lead with the operating pain in "${brief.topic}".`,
            `Show the gated desk loop. End on ${brief.offerCta}.`,
            ``,
            `## Source draft excerpt`,
            priorBlock(input.priorArtifacts, "ghost"),
          ].join("\n"),
          meta: { provider: "placeholder", stage },
        };
      case "press":
        return {
          title: `Press packs — ${channels}`,
          body: [
            `# Press · Per-channel packs`,
            ``,
            ...brief.channels.flatMap((ch) => [
              `## ${ch}`,
              ch === "x"
                ? `- Short: ${brief.topic} → gated desk, not another calendar app. ${brief.offerCta}`
                : ch === "linkedin"
                  ? `- Narrative: Operators drown in almost-ships. Desk adds approve gates. CTA: ${brief.offerCta}`
                  : ch === "newsletter"
                    ? `- Subject: Stop filing drafts in the void\n- Body: Walk Scout→Echo for "${brief.topic}". CTA: ${brief.offerCta}`
                    : ch === "blog"
                      ? `- Outline: Problem → Desk stages → Warm review → CTA (${brief.offerCta})`
                      : `- Pack stub for ${ch}: adapt Editor throughline; CTA ${brief.offerCta}`,
              ``,
            ]),
            `## Editor excerpt`,
            priorBlock(input.priorArtifacts, "editor"),
          ].join("\n"),
          meta: { provider: "placeholder", stage, channels: brief.channels },
        };
      case "clock":
        return {
          title: `Clock · Schedule plan`,
          body: [
            `# Clock · Calendar plan`,
            ``,
            `Scheduling packs for: ${channels}`,
            `Due anchor: ${brief.dueAt ?? "plus 3–5 days from generation"}`,
            ``,
            `## Placement`,
            ...brief.channels.map(
              (ch, i) =>
                `- ${ch}: slot T+${i + 1} day(s) — status planned (no live publish)`,
            ),
            ``,
            `Approving this stage writes Desk calendar items. Publishing stays offline.`,
          ].join("\n"),
          meta: { provider: "placeholder", stage },
        };
      case "echo":
        return {
          title: `Echo · Reply drafts`,
          body: [
            `# Echo · Inbox reply drafts`,
            ``,
            `Drafted replies for engagement on "${brief.topic}".`,
            `Sending is gated — mark approved / copied only. No live network send.`,
            ``,
            `## Reply A (curious)`,
            `Appreciate you reading — Desk is the newsroom mode inside MatOS.`,
            `Happy to walk Scout→Echo if useful. ${brief.offerCta}`,
            ``,
            `## Reply B (skeptical)`,
            `Fair pushback. Gates exist so Operators approve before anything schedules.`,
            `Nothing auto-publishes in this phase.`,
            ``,
            `## Reply C (ready to act)`,
            `Open Desk, drop the brief, approve each stage. ${brief.offerCta}`,
          ].join("\n"),
          meta: { provider: "placeholder", stage },
        };
      default:
        return {
          title: `${label} artifact`,
          body: `Stub artifact for ${stage}`,
          meta: { provider: "placeholder", stage },
        };
    }
  }
}

/**
 * Optional OpenAI path. Without OPENAI_API_KEY, falls back to placeholders.
 * Live publish / external channel APIs are intentionally not called.
 */
export class OpenAiDeskProvider implements DeskLlmProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fallback: DeskLlmProvider = new PlaceholderDeskProvider(),
  ) {}

  async generate(input: DeskGenerateInput): Promise<DeskGenerateResult> {
    try {
      const prompt = [
        `You are MatOS Desk (${STAGE_LABELS[input.stage]}).`,
        `Return markdown for stage=${input.stage}.`,
        `Topic: ${input.brief.topic}`,
        `Audience: ${input.brief.audience}`,
        `Offer/CTA: ${input.brief.offerCta}`,
        `Channels: ${input.brief.channels.join(", ")}`,
        `Prior:\n${input.priorArtifacts.map((a) => `## ${a.stage}\n${a.body}`).join("\n\n").slice(0, 6000)}`,
      ].join("\n");

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_DESK_MODEL ?? "gpt-4o-mini",
          messages: [
            { role: "system", content: "Write precise operator markdown. No hype." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
        }),
      });
      if (!res.ok) return this.fallback.generate(input);
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const body = data.choices?.[0]?.message?.content?.trim();
      if (!body) return this.fallback.generate(input);
      return {
        title: `${STAGE_LABELS[input.stage]} — ${input.brief.topic}`,
        body,
        meta: { provider: "openai", stage: input.stage },
      };
    } catch {
      return this.fallback.generate(input);
    }
  }
}

export function getDeskProvider(): DeskLlmProvider {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (key) return new OpenAiDeskProvider(key);
  return new PlaceholderDeskProvider();
}
