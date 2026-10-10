/**
 * Which authored skill is responsible for which desk stage.
 *
 * This is the other half of the learning loop. A draft is rejected, and the
 * reason is almost never the model — it is that the skill governing that stage
 * was thin, wrong, or missing. Without this mapping the owner sees "this draft
 * is bad" and has nowhere to go; with it, the rejection carries a link to the
 * exact skill to fix, and the next run of the same stage is better because the
 * skill is better.
 *
 * The map is authored, not derived. Inferring the responsible skill from a
 * stage name would be a guess dressed as a fact, and a wrong link is worse than
 * no link: it sends the owner to edit a skill that had nothing to do with the
 * failure. A stage with no honest match returns null and the UI says so.
 */

import type { DeskStage } from "@/lib/desk/stages";

export type SkillLink = {
  /** The SKILL.md slug, stable across renames of the display title. */
  slug: string;
  /**
   * True when the skill this stage needs does not exist in the company map.
   * A missing skill is a finding, not a dead end: the link still points at
   * `/skills` so the owner can author it, but the UI must not imply a skill is
   * there to read.
   */
  missing: boolean;
  /** How the stage depends on the skill, shown next to the link. */
  reason: string;
};

/**
 * Stage → skill. Only stages with an honest match appear.
 *
 * The slugs are the ones the company actually has, read from the seed rather
 * than invented: an invented slug that resolves to nothing would make every
 * link read "author this" and train the owner to ignore the link entirely.
 *
 * `clock` and `echo` are deliberately absent. Clock materialises approved Press
 * packages into calendar rows and Echo drafts replies from the same packages —
 * neither authors anything, so neither has a skill whose improvement would
 * change its output. Pointing at a nearby skill to fill the gap would be the
 * exact wrong-link failure this module exists to avoid.
 */
export const STAGE_SKILL: Partial<Record<DeskStage, SkillLink>> = {
  scout: {
    slug: "trend-radar",
    missing: false,
    reason:
      "Scout turns a topic into an operating problem, which is what Trend Radar decides. Notes that read like a content tip trace back here.",
  },
  ghost: {
    slug: "short-script",
    missing: false,
    reason:
      "Ghost writes the draft, and this is the skill that shapes it. A flat or generic draft is a skill problem before it is a model problem.",
  },
  editor: {
    slug: "hook-lab",
    missing: false,
    reason:
      "Editor polishes what Ghost wrote. When the opening is the weak part, Hook Lab is the skill that decides what an opening has to do.",
  },
  press: {
    slug: "content-calendar",
    missing: false,
    reason:
      "Press adapts the draft per channel. Packages that read the same everywhere mean this skill is not doing its job.",
  },
};

/**
 * The skill link for a stage, or null when that stage has no honest one.
 *
 * `authoredSlugs` is the set of skills the company actually has. Passing it in
 * rather than querying here keeps this module pure and testable, and keeps the
 * database read at the call site where the owner's scope is already resolved.
 */
export function skillLinkForStage(
  stage: string,
  authoredSlugs: readonly string[],
): SkillLink | null {
  const link = STAGE_SKILL[stage as DeskStage];
  if (!link) return null;
  return {
    ...link,
    // A stage whose skill has not been authored yet is still a real link to a
    // real gap. `missing` drives the wording, not whether a link exists.
    missing: !authoredSlugs.includes(link.slug),
  };
}

/**
 * Where the link goes. Always a real destination: an authored skill opens the
 * map focused on it, a missing one opens the skills list to author it.
 */
export function skillHref(link: SkillLink): string {
  return link.missing
    ? "/skills"
    : `/map?skill=${encodeURIComponent(link.slug)}`;
}

/** The one line shown beside the link, which must not overclaim. */
export function skillLinkLabel(link: SkillLink): string {
  return link.missing
    ? `No \`${link.slug}\` skill exists yet — author it`
    : `Fix the \`${link.slug}\` skill`;
}
