import { describe, expect, it } from "vitest";
import type { TranscriptSegment } from "@/lib/desk/sources";
import {
  checkHook,
  HOOK_WINDOW_MS,
  hookApplicable,
  hookWindow,
  isHousekeeping,
  isYouTubeSkill,
  YOUTUBE_SKILLS,
} from "./youtube";

/** Build segments from `[startMs, text]` pairs, ending each 2s after it starts. */
function seg(...pairs: Array<[number, string]>): TranscriptSegment[] {
  return pairs.map(([startMs, text]) => ({
    startMs,
    endMs: startMs + 2_000,
    text,
  }));
}

/**
 * These tests are written against the same principle as the module: a check
 * that cannot fail is decoration. So most of them assert the *negative* — the
 * video that is rejected and the sentence that caused it — because a test that
 * only proves "a good hook passes" would pass for a function that returns `ok`
 * unconditionally.
 */

describe("youtube skill registry", () => {
  it("names exactly the three skills that were ported", () => {
    expect([...YOUTUBE_SKILLS]).toEqual(["hook", "loop", "pillars"]);
  });

  it("recognises its own skills and nothing else", () => {
    expect(isYouTubeSkill("hook")).toBe(true);
    expect(isYouTubeSkill("thumbnails")).toBe(false);
  });
});

describe("hook window extraction", () => {
  it("keeps only what starts inside the window", () => {
    const win = hookWindow(
      seg([0, "first"], [14_999, "just inside"], [15_000, "exactly at the edge"], [20_000, "body"]),
    );
    // The boundary is start-inclusive, end-exclusive: a segment *starting* at
    // the window edge is the body, not the opening. Anything else would let the
    // window silently grow with the transcript's segmentation.
    expect(win.lines.map((l) => l.text)).toEqual(["first", "just inside"]);
  });

  it("strips housekeeping before deciding what the opening is", () => {
    const win = hookWindow(
      seg([0, "Hey guys, welcome back to the channel!"], [3_000, "I lost $40,000 in March."]),
    );
    expect(win.lines.map((l) => l.text)).toEqual(["I lost $40,000 in March."]);
    // The point of stripping: the housekeeping line would otherwise *be* the
    // opening and the hook check would grade a greeting.
    expect(win.lines[0]!.startMs).toBe(3_000);
  });

  it("marks a window that is empty because every line was housekeeping", () => {
    const win = hookWindow(seg([0, "Welcome back!"], [5_000, "Don't forget to subscribe."]));
    expect(win.emptyWindow).toBe(true);
  });

  it("recognises the housekeeping patterns it claims to", () => {
    expect(isHousekeeping("Hey everyone, quick one today")).toBe(true);
    expect(isHousekeeping("Before we get started, a word from our sponsor")).toBe(true);
    expect(isHousekeeping("This video is sponsored by Acme")).toBe(true);
    expect(isHousekeeping("I lost $40,000 in March")).toBe(false);
  });
});

describe("checkHook — the negative cases", () => {
  it("fails a video whose opening is all housekeeping, and says which failure it is", () => {
    const result = checkHook(seg([0, "Hey guys!"], [4_000, "Welcome back to the channel."]));
    expect(result.ok).toBe(false);
    // Two different problems share the symptom "empty window". Reporting the
    // wrong one would send the owner to fix a greeting that does not exist.
    expect(result.findings[0]!.code).toBe("hook_window_is_housekeeping");
  });

  it("fails a video with no speech in the first fifteen seconds, differently", () => {
    const result = checkHook(seg([16_000, "So anyway, here's the thing."]));
    expect(result.ok).toBe(false);
    expect(result.findings[0]!.code).toBe("hook_window_empty");
  });

  it("fails a vague opening and names the hedge that made it vague", () => {
    const result = checkHook(seg([0, "Today I'm going to talk about content strategy."]));
    expect(result.ok).toBe(false);
    const vague = result.findings.find((f) => f.code === "hook_vague");
    expect(vague).toBeDefined();
    // The detail has to point at the actual phrase, otherwise the finding is
    // "your hook is bad" — which the owner cannot act on.
    expect(vague!.detail).toMatch(/talk about/i);
    expect(vague!.evidence).toBe("Today I'm going to talk about content strategy.");
    expect(vague!.atMs).toBe(0);
  });

  it("fails a generic-audience opening that would otherwise look confident", () => {
    const result = checkHook(seg([0, "Most people get content strategy completely wrong."]));
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "hook_vague")).toBe(true);
  });

  it("flags a hook that only lands on the second or third line", () => {
    const result = checkHook(
      seg(
        [0, "So here's something interesting."],
        [4_000, "I want to share a quick story."],
        [9_000, "I lost $40,000 in March doing this."],
      ),
    );
    const delayed = result.findings.find((f) => f.code === "hook_delayed");
    expect(delayed).toBeDefined();
    // And it must say *when*, because "late" without a timestamp is not
    // checkable in ten seconds the way the rest of the system promises.
    expect(delayed!.atMs).toBe(9_000);
    expect(delayed!.detail).toMatch(/00:09/);
    expect(result.ok).toBe(false);
  });

  it("flags a claim resolved inside the window as no reason to stay", () => {
    const result = checkHook(
      seg([0, "I lost $40,000 in March."], [5_000, "In short, I was wrong about the offer."]),
    );
    expect(result.findings.some((f) => f.code === "hook_paid_too_early")).toBe(true);
    expect(result.ok).toBe(false);
  });
});

describe("checkHook — the positive case", () => {
  it("passes a specific, immediate, unresolved opening", () => {
    const result = checkHook(
      seg(
        [0, "I lost $40,000 in March."],
        [5_000, "And the reason is not what you think."],
        [12_000, "It started with one email."],
      ),
    );
    expect(result.ok).toBe(true);
    expect(result.findings.find((f) => f.code === "hook_specific")?.ok).toBe(true);
    expect(result.findings.find((f) => f.code === "hook_immediate")?.ok).toBe(true);
    expect(result.findings.find((f) => f.code === "hook_open_loop")?.ok).toBe(true);
  });

  it("never claims to have watched the video", () => {
    const result = checkHook(seg([0, "I lost $40,000 in March."], [5_000, "Here's why."]));
    // The one thing this module must not imply. Every result carries the
    // caveat so no caller can read a pass as "the video is good".
    expect(result.transcriptOnly).toBe(true);
  });
});

describe("hook applicability", () => {
  it("refuses to grade a video too short to have an opening window", () => {
    // A 6-second video has no first fifteen seconds. Applying the rule anyway
    // would produce a confident finding about a window that does not exist.
    expect(hookApplicable(seg([0, "Quick tip!"], [4_000, "Done."]))).toBe(false);
    expect(
      hookApplicable(seg([0, "Opening"], [HOOK_WINDOW_MS, "Body"], [20_000, "End"])),
    ).toBe(true);
  });
});
