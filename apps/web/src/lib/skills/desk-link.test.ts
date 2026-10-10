import { describe, expect, it } from "vitest";
import { STAGE_SKILL, skillHref, skillLinkForStage, skillLinkLabel } from "./desk-link";

const ALL_AUTHORED = [
  "hook-lab",
  "short-script",
  "content-calendar",
  "etsy-listing-lab",
];

describe("stage to skill mapping", () => {
  it("links the four authoring stages and refuses the two that only materialise", () => {
    expect(Object.keys(STAGE_SKILL).sort()).toEqual([
      "editor",
      "ghost",
      "press",
      "scout",
    ]);
    // Clock turns approved Press packages into calendar rows and Echo drafts
    // replies from those same packages. Neither authors, so neither has a
    // skill whose improvement would change its output. A nearby skill would be
    // a wrong link, and a wrong link is worse than no link.
    expect(skillLinkForStage("clock", ALL_AUTHORED)).toBeNull();
    expect(skillLinkForStage("echo", ALL_AUTHORED)).toBeNull();
    expect(skillLinkForStage("filed", ALL_AUTHORED)).toBeNull();
  });

  it("marks a stage whose skill has not been authored", () => {
    const linked = skillLinkForStage("ghost", ALL_AUTHORED);
    expect(linked?.missing).toBe(false);

    const gap = skillLinkForStage("ghost", []);
    expect(gap?.slug).toBe("short-script");
    // Still a link, and still a real destination: an unauthored skill is a
    // finding with somewhere to go, not a dead end.
    expect(gap?.missing).toBe(true);
  });

  it("sends an authored skill to the map and a missing one to the skills list", () => {
    // Ghost is the one authoring stage whose skill is authored in the seed, so
    // it exercises the resolved branch; Scout's Trend Radar is still planned and
    // exercises the missing one below.
    const authored = skillLinkForStage("ghost", ALL_AUTHORED)!;
    expect(skillHref(authored)).toBe("/map?skill=short-script");
    expect(skillLinkLabel(authored)).toBe("Fix the `short-script` skill");

    const missing = skillLinkForStage("scout", [])!;
    expect(skillHref(missing)).toBe("/skills");
    expect(skillLinkLabel(missing)).toBe(
      "No `trend-radar` skill exists yet — author it",
    );
  });

  it("never claims a skill is there when it is not", () => {
    for (const link of Object.values(STAGE_SKILL)) {
      const missing = skillLinkForStage("", []);
      expect(missing).toBeNull();
      const resolvedMissing = { ...link, missing: true };
      expect(skillLinkLabel(resolvedMissing)).toContain("No");
    }
  });
});
