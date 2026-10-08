import { describe, expect, it } from "vitest";
import type { TranscriptSegment } from "@/lib/desk/sources";
import { gradeTranscript, renderGradeForBrief } from "./grade";
import type { PillarDefinition } from "./youtube-pillars";

function seg(...pairs: Array<[number, string]>): TranscriptSegment[] {
  return pairs.map(([startMs, text]) => ({ startMs, endMs: startMs + 3_000, text }));
}

const PILLARS: PillarDefinition[] = [
  { id: "faceless-youtube", label: "Faceless YouTube", markers: ["faceless youtube"] },
  { id: "email-list", label: "Email List", markers: ["email list"] },
];

/** A video that passes all three skills. */
const GOOD = seg(
  [0, "I lost $40,000 in March."],
  [6_000, "And the reason is not what you think."],
  [40_000, "In this video I explain the faceless youtube workflow."],
  [70_000, "Here's why the faceless youtube setup works."],
  [110_000, "This video is about faceless youtube channels."],
);

describe("gradeTranscript — ordering", () => {
  it("runs all three skills over one transcript", () => {
    const grade = gradeTranscript(GOOD, { durationMs: 300_000, pillars: PILLARS });
    const skills = new Set(grade.findings.map((f) => f.skill));
    expect(skills).toEqual(new Set(["hook", "loop", "pillars"]));
  });

  it("names the hook as the first problem when the opening is housekeeping", () => {
    const video = seg(
      [0, "Hey guys, welcome back to the channel!"],
      [6_000, "Don't forget to subscribe."],
      [40_000, "In this video I explain the faceless youtube workflow."],
      [70_000, "Here's why the faceless workflow works."],
      [110_000, "This video is about faceless youtube."],
    );
    const grade = gradeTranscript(video, { durationMs: 300_000, pillars: PILLARS });
    // The loop and pillars findings may also be imperfect here, but the hook is
    // the top of the funnel: a video nobody watches past fifteen seconds has no
    // payoff problem worth reporting yet.
    expect(grade.firstProblem).toBe("hook");
    expect(grade.ok).toBe(false);
  });

  it("does not let a channel-level pillar gap outrank a broken hook", () => {
    const video = seg(
      [0, "Today I'm going to talk about content strategy."],
      [40_000, "In this video I explain the faceless youtube workflow."],
      [70_000, "This video is about faceless youtube."],
    );
    const grade = gradeTranscript(video, { durationMs: 300_000, pillars: [] });
    // "No pillars defined" is real, but it is the channel's problem and will
    // still be there tomorrow. The video's own opening is what the owner is
    // looking at right now.
    expect(grade.findings.some((f) => f.code === "no_pillars_defined")).toBe(true);
    expect(grade.firstProblem).toBe("hook");
  });

  it("falls through to the loop when the hook is clean", () => {
    const video = seg(
      [0, "I lost $40,000 in March."],
      [6_000, "And the reason is not what you think."],
      [40_000, "Coming up, the faceless youtube workflow."],
      [70_000, "In this video I explain the faceless youtube workflow."],
      [120_000, "This video is about faceless youtube."],
      [230_000, "So that's why the workflow works."],
    );
    // A promise raised at 40s whose only payoff lands at 96% of the runtime —
    // the hook is fine, so the loop placement is what the owner should look at.
    const grade = gradeTranscript(video, { durationMs: 240_000, pillars: PILLARS });
    expect(grade.firstProblem).toBe("loop");
  });
});

describe("gradeTranscript — skipping is not passing", () => {
  it("records a short video as skipped rather than clean", () => {
    const grade = gradeTranscript(seg([0, "Quick tip!"], [4_000, "Done."]));
    const hookSkip = grade.skipped.find((s) => s.skill === "hook");
    expect(hookSkip).toBeDefined();
    expect(hookSkip!.reason).toMatch(/hook window/i);
    // The distinction that matters: a caller reading `skipped` learns the video
    // was never examined, where a bare omission would read as a pass.
    expect(grade.findings.some((f) => f.skill === "hook")).toBe(false);
  });

  it("reports an empty transcript as nothing transcribed rather than ungraded", () => {
    const grade = gradeTranscript([]);
    const block = renderGradeForBrief(grade);
    expect(block).not.toBeNull();
    // The transcript is empty, not merely short. Reporting it as a hook-window
    // skip would describe a video that was never transcribed — the failure the
    // source layer already refuses to hide, and this layer must not reintroduce.
    expect(grade.skipped.some((s) => s.reason.match(/hook window/i))).toBe(false);
    expect(grade.skipped.some((s) => s.skill === "hook")).toBe(true);
    // The block must not present an untranscribed video as a pass, and the two
    // checks that do run over an empty transcript may only be the two that are
    // honest about having nothing to read.
    const codes = grade.findings.map((f) => f.code);
    expect(codes).toContain("no_pillars_defined");
    expect(block!).toMatch(/Nothing graded/);
  });
});

describe("renderGradeForBrief", () => {
  it("lists failures with the sentence and the timestamp", () => {
    const video = seg(
      [0, "Today I'm going to talk about content strategy."],
      [6_000, "Here's a chart."],
      [20_000, "More body."],
    );
    const block = renderGradeForBrief(gradeTranscript(video, { durationMs: 200_000 }));
    expect(block).toContain("[hook] hook_vague @ 00:00");
    expect(block).toContain("> Today I'm going to talk about content strategy.");
  });

  it("says the findings are about an existing video, not the draft", () => {
    const block = renderGradeForBrief(
      gradeTranscript(seg([0, "Welcome back!"], [5_000, "Subscribe."]), {
        durationMs: 200_000,
      }),
    );
    // Without this line the draft stage can read a failed check as advice and
    // write a newsletter that never mentions the video it is about.
    expect(block).toMatch(/existing\*? video's transcript, not instructions/i);
  });

  it("states the fix-first skill rather than leaving a flat list", () => {
    const video = seg(
      [0, "Hey guys!"],
      [6_000, "Welcome back to the channel."],
      [40_000, "In this video I explain email lists."],
      [70_000, "This video is about email lists."],
    );
    const block = renderGradeForBrief(
      gradeTranscript(video, { durationMs: 200_000, pillars: PILLARS }),
    );
    expect(block).toMatch(/Fix first: \*\*hook\*\*/);
  });

  it("does not report a clean bill of health as a quality judgment", () => {
    const block = renderGradeForBrief(
      gradeTranscript(GOOD, { durationMs: 300_000, pillars: PILLARS }),
    );
    expect(block).toContain("No structural failure found");
    // The distinction the whole module is built around: passing these checks is
    // not the same as the video being good.
    expect(block).toMatch(/not a judgment on whether the video is good/i);
  });

  it("lists what was not checked instead of dropping it silently", () => {
    const block = renderGradeForBrief(gradeTranscript(seg([0, "Quick tip!"], [4_000, "Done."])));
    expect(block).toContain("**Not checked**");
    expect(block).toContain("[hook]");
  });
});
