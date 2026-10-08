import { describe, expect, it } from "vitest";
import type { TranscriptSegment } from "@/lib/desk/sources";
import {
  checkPillars,
  matchPillars,
  MIN_TOPIC_STATEMENTS,
  topicStatements,
  type PillarDefinition,
} from "./youtube-pillars";

function seg(...pairs: Array<[number, string]>): TranscriptSegment[] {
  return pairs.map(([startMs, text]) => ({ startMs, endMs: startMs + 3_000, text }));
}

/**
 * As with Hook and Loop, most of these assert the negative. A pillars check
 * that reported "on pillar" for everything would pass every happy-path test
 * here, so the assertions that matter are on the videos it rejects and the
 * finding code it rejects them with.
 */

const PILLARS: PillarDefinition[] = [
  { id: "faceless-youtube", label: "Faceless YouTube", markers: ["faceless youtube", "faceless channel"] },
  { id: "email-list", label: "Email List", markers: ["email list", "newsletter"] },
  { id: "monetization", label: "Monetization", markers: ["monetization", "monetize", "revenue"] },
];

describe("topicStatements", () => {
  it("pulls the clause, not the whole segment", () => {
    const found = topicStatements(
      seg([0, "Alright. In this video I explain the faceless workflow. Let's go."]),
    );
    // A segment can run for ten seconds and hold three sentences. Returning all
    // of them would match pillars the video never claimed.
    expect(found).toEqual(["In this video I explain the faceless workflow"]);
  });

  it("finds topic statements wherever they appear, not only at the top", () => {
    const found = topicStatements(
      seg([0, "Cold open, no context."], [30_000, "Today's video is about building an email list."]),
    );
    expect(found).toHaveLength(1);
  });

  it("reports nothing when the transcript never states a topic", () => {
    const found = topicStatements(
      seg([0, "So the camera was rolling."], [5_000, "Anyway, that was the day."]),
    );
    expect(found).toEqual([]);
  });
});

describe("matchPillars", () => {
  it("matches a marker as a substring, so the owner's plural still lands", () => {
    // Word-boundary matching would fail here, and the channel's own video would
    // come back an orphan for a reason invisible in the label "Email List".
    const matched = matchPillars("how to grow email lists fast", PILLARS);
    expect(matched.map((p) => p.id)).toEqual(["email-list"]);
  });

  it("is case-insensitive", () => {
    expect(matchPillars("MONETIZATION FOR BEGINNERS", PILLARS).map((p) => p.id)).toEqual([
      "monetization",
    ]);
  });

  it("ignores a blank marker rather than matching everything", () => {
    const sloppy: PillarDefinition[] = [{ id: "x", label: "X", markers: ["  "] }];
    expect(matchPillars("anything at all", sloppy)).toEqual([]);
  });
});

describe("checkPillars — the channel-level failures", () => {
  it("names the channel gap when no pillars are declared, not every video as an orphan", () => {
    const result = checkPillars(
      seg([0, "In this video I explain the funnel."], [20_000, "This video is about funnels."]),
    );
    expect(result.ok).toBe(false);
    expect(result.findings[0]!.code).toBe("no_pillars_defined");
    // Every video is an orphan in a channel with no pillars. Reporting that per
    // video blames the video for a decision the channel never made.
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.detail).toMatch(/channel-level gap/i);
  });

  it("refuses to judge membership when the transcript never says what it is about", () => {
    const result = checkPillars(seg([0, "Roll the clip."], [10_000, "There it is."]), {
      pillars: PILLARS,
    });
    expect(result.ok).toBe(false);
    expect(result.findings[0]!.code).toBe("topic_not_stated");
    // Distinct from off-pillar: the fix is "say what the video is for", not
    // "move it onto a pillar". One finding, so the owner is not sent to fix a
    // mismatch that was never measured.
    expect(result.findings).toHaveLength(1);
    expect(result.orphan).toBe(false);
  });

  it("treats a single topic statement as not enough to judge", () => {
    const result = checkPillars(seg([0, "In this video I explain the faceless workflow."]), {
      pillars: PILLARS,
    });
    expect(result.findings[0]!.code).toBe("topic_not_stated");
    expect(result.findings[0]!.detail).toMatch(/only once/i);
  });
});

describe("checkPillars — the per-video verdict", () => {
  it("fails a video that is about something the channel is not about", () => {
    const result = checkPillars(
      seg(
        [0, "In this video I explain how I shoot on a cinema camera."],
        [30_000, "This video is about cinema cameras."],
      ),
      { pillars: PILLARS },
    );
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "orphan_video")).toBe(true);
    const orphan = result.findings.find((f) => f.code === "orphan_video")!;
    // It has to concede the video may be good. The claim is not "this is a bad
    // video", it is "nothing in it compounds".
    expect(orphan.detail).toMatch(/may be a good video/i);
  });

  it("passes a video that sits on one pillar", () => {
    const result = checkPillars(
      seg(
        [0, "In this video I explain the faceless youtube workflow."],
        [30_000, "This video is about faceless youtube."],
      ),
      { pillars: PILLARS },
    );
    expect(result.ok).toBe(true);
    expect(result.findings.some((f) => f.code === "on_pillar")).toBe(true);
    expect(result.matched.map((p) => p.id)).toEqual(["faceless-youtube"]);
  });

  it("fails a video that straddles several pillars at once", () => {
    const result = checkPillars(
      seg(
        [0, "In this video I explain monetization for a faceless youtube channel."],
        [30_000, "This video is about monetization and faceless youtube."],
      ),
      { pillars: PILLARS },
    );
    expect(result.ok).toBe(false);
    const straddle = result.findings.find((f) => f.code === "straddles_pillars")!;
    expect(straddle).toBeDefined();
    // The reason, not just the verdict: a viewer arriving for one pillar is
    // handed the others.
    expect(straddle.detail).toMatch(/arrives for one of them/i);
  });
});

describe("checkPillars — history, when the caller supplies it", () => {
  const onPillar = seg(
    [0, "In this video I explain the faceless youtube workflow."],
    [30_000, "This video is about faceless youtube."],
  );

  it("calls an on-pillar video a continuation when the pillar is established", () => {
    const result = checkPillars(onPillar, {
      pillars: PILLARS,
      publishedTopics: ["faceless-youtube", "email-list"],
    });
    expect(result.findings.some((f) => f.code === "pillar_continuation")).toBe(true);
  });

  it("does not call it a continuation when the pillar is new", () => {
    const result = checkPillars(onPillar, {
      pillars: PILLARS,
      publishedTopics: ["email-list"],
    });
    const started = result.findings.find((f) => f.code === "pillar_started")!;
    expect(started).toBeDefined();
    // And it must not oversell one video as an established pillar.
    expect(started.detail).toMatch(/one video is not yet a pillar/i);
    expect(result.findings.some((f) => f.code === "pillar_continuation")).toBe(false);
  });

  it("says nothing about history when the caller did not supply it", () => {
    const result = checkPillars(onPillar, { pillars: PILLARS });
    const historyCodes = ["pillar_continuation", "pillar_started", "pillar_mixed"];
    // Silence rather than a guess: with no published list the module cannot
    // know, and inventing "continuation" for a first video would be a claim
    // about the channel it never read.
    expect(result.findings.some((f) => historyCodes.includes(f.code))).toBe(false);
  });

  it("flags a channel whose work has not spread across its pillars", () => {
    const result = checkPillars(onPillar, {
      pillars: PILLARS,
      publishedTopics: ["faceless-youtube"],
    });
    const narrow = result.findings.find((f) => f.code === "narrow_pillar_spread")!;
    expect(narrow).toBeDefined();
    expect(narrow.ok).toBe(false);
    expect(narrow.detail).toMatch(/1 of its 3 pillars/);
    expect(result.ok).toBe(false);
  });

  it("passes the spread check once enough pillars carry work", () => {
    const result = checkPillars(onPillar, {
      pillars: PILLARS,
      publishedTopics: ["faceless-youtube", "email-list"],
    });
    const spread = result.findings.find((f) => f.code === "pillar_spread_ok")!;
    expect(spread).toBeDefined();
    expect(spread.ok).toBe(true);
    expect(result.ok).toBe(true);
  });
});

describe("pillars — the honesty boundary", () => {
  it("never claims to have seen the channel", () => {
    const result = checkPillars(
      seg([0, "In this video I explain email lists."], [20_000, "This video is about email lists."]),
      { pillars: PILLARS },
    );
    expect(result.transcriptOnly).toBe(true);
    expect(result.skill).toBe("pillars");
  });

  it("exposes its threshold rather than hiding it in the comparison", () => {
    expect(MIN_TOPIC_STATEMENTS).toBe(2);
  });
});
