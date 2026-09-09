import type { ContentGate } from "./types";

export const GATE_ORDER: ContentGate[] = [
  "draft",
  "warm",
  "approved",
  "scheduled",
  "published",
];

export function isNextGate(from: ContentGate, to: ContentGate): boolean {
  return GATE_ORDER.indexOf(to) === GATE_ORDER.indexOf(from) + 1;
}

export function canAdvanceGate(
  from: ContentGate,
  to: ContentGate,
): { ok: true } | { ok: false; error: string } {
  if (from === to) {
    return { ok: false, error: `Already at ${from}` };
  }
  if (to === "published") {
    if (from === "approved" || from === "scheduled") {
      return { ok: true };
    }
    return {
      ok: false,
      error: "Cannot publish without approved (or scheduled) gate",
    };
  }
  if (!isNextGate(from, to)) {
    return {
      ok: false,
      error: `Invalid gate transition ${from} → ${to}; advance one step at a time`,
    };
  }
  return { ok: true };
}

export const PUBLISH_SKILL_SLUGS = new Set([
  "scheduler",
  "etsy-publish",
  "whatsapp-drop",
  "channel-connect",
  "native-adapt",
  "manual-handoff",
]);

export function isPublishSkill(slug: string): boolean {
  return PUBLISH_SKILL_SLUGS.has(slug);
}

export function canSimulatePublish(gate: ContentGate): boolean {
  return gate === "approved" || gate === "scheduled" || gate === "published";
}
