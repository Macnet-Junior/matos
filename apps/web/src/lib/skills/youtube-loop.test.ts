import { describe, expect, it } from "vitest";
import type { TranscriptSegment } from "@/lib/desk/sources";
import { checkLoop, DEFAULT_LOOP_THRESHOLDS } from "./youtube-loop";

function seg(...pairs: Array<[number, string]>): TranscriptSegment[] {
  return pairs.map(([startMs, text]) => ({ startMs, endMs: startMs + 3_000, text }));
}

/**
 * As with the Hook tests, most of these assert the negative. A loop checker
 * that passes everything would pass every happy-path test here too, so the
 * interesting assertions are on the videos it rejects and the reason code it
 * rejects them with.
 */

describe("checkLoop — refuses to invent a verdict", () => {
  it("says so when there is no explicit loop to grade, rather than passing it", () => {
    const result = checkLoop(seg([0, "Content strategy matters."], [5_000, "Here is a chart."]));
    expect(result.opened).toHaveLength(0);
    // A video with no explicit promise is not a failure — but "ok" here must
    // mean "nothing to check", and the detail has to say that. A bare pass
    // would read as an endorsement of a video this skill never examined.
    expect(result.findings[0]!.code).toBe("no_explicit_loops");
    expect(result.findings[0]!.detail).toMatch(/no loop for this skill to grade/i);
  });

  it("fails a video that raises a question and never answers it", () => {
    const result = checkLoop(
      seg(
        [0, "Stay with me, I'll show you the exact framework."],
        [30_000, "So anyway, that's the intro."],
        [60_000, "Let's talk about something else entirely."],
      ),
    );
    expect(result.ok).toBe(false);
    // This is the worst shape: the time was spent and nothing was delivered.
    expect(result.findings.some((f) => f.code === "loop_never_closes")).toBe(true);
  });
});

describe("checkLoop — placement", () => {
  // The markers are literal, so the fixtures name a payoff the way the module
  // looks for one: "the answer is" / "here's why". A fixture that paraphrases
  // would leave `closed` empty and the placement tests would silently grade a
  // video with no payoff at all.
  const video: TranscriptSegment[] = seg(
    [0, "Coming up, three mistakes that cost me money."],
    [40_000, "Mistake one is the obvious one."],
    [120_000, "Here's why mistake two is different."],
  );

  it("passes a payoff that lands past the opening and short of the end", () => {
    const result = checkLoop(video, { durationMs: 200_000 });
    const placed = result.findings.find((f) => f.code === "loop_payoff_placed");
    expect(placed).toBeDefined();
    expect(placed!.ok).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("fails a payoff that lands before the viewer has committed", () => {
    // 120s payoff in a 600s video = 20%, right at the default edge. Tighten the
    // threshold so the same video fails outright, which is what proves the
    // comparison is live rather than the code happening to land on the happy
    // path.
    const result = checkLoop(video, {
      durationMs: 600_000,
      thresholds: { earlyCloseFraction: 0.5 },
    });
    const early = result.findings.find((f) => f.code === "loop_closed_too_early");
    expect(early).toBeDefined();
    expect(early!.detail).toMatch(/first 50%/);
    expect(result.ok).toBe(false);
  });

  it("fails a payoff that lands after the audience has gone", () => {
    const late: TranscriptSegment[] = seg(
      [0, "Coming up, the one setting nobody changes."],
      [190_000, "The answer is to lower the bitrate."],
    );
    // 190s of 200s = 95%, past the 90% default — a payoff that arrives after
    // most of the audience has already gone.
    const result = checkLoop(late, { durationMs: 200_000 });
    const tooLate = result.findings.find((f) => f.code === "loop_closed_too_late");
    expect(tooLate).toBeDefined();
    expect(tooLate!.detail).toMatch(/last 10%/);
  });

  it("uses the caller's duration rather than guessing from the last segment", () => {
    // The published runtime and the transcript's last segment disagree all the
    // time — music, silence, an outro card. Taking the number when it is given
    // is what keeps the placement finding tied to what a viewer experienced.
    const video2 = seg([0, "Coming up, three things."], [50_000, "Here's why it works."]);
    // Same transcript, same payoff, two different runtimes — and the finding
    // flips between them. That flip is the proof the number is used rather than
    // the transcript's own length standing in for it.
    //
    // Guessed from the transcript (last line ends at 53s): the 50s payoff is
    // 94% of the way in, so it lands too late.
    const guessed = checkLoop(video2);
    expect(guessed.findings.some((f) => f.code === "loop_closed_too_late")).toBe(true);
    // Told a real 8-minute runtime: the same payoff is a sixteenth of the way
    // in and now lands far too early instead.
    const told = checkLoop(video2, { durationMs: 480_000 });
    expect(told.findings.map((f) => f.code)).not.toEqual(
      guessed.findings.map((f) => f.code),
    );
    expect(told.findings.some((f) => f.code === "loop_closed_too_early")).toBe(true);
  });
});

describe("checkLoop — the ending", () => {
  it("notices when nothing is left open to carry a viewer onward", () => {
    const result = checkLoop(
      seg([0, "Coming up, why this matters."], [30_000, "Here's why this matters."]),
    );
    const ending = result.findings.find((f) => f.code === "loop_fully_closed");
    expect(ending).toBeDefined();
    expect(ending!.detail).toMatch(/nothing carries a viewer into the next video/i);
  });

  it("counts the questions still open at the end", () => {
    const result = checkLoop(
      seg(
        [0, "Coming up, I'll show you the setup."],
        [10_000, "Stick around for the part nobody talks about."],
        [60_000, "Here's why the setup matters."],
      ),
      { durationMs: 120_000 },
    );
    // One of two answered. The finding is informational and must not fail the
    // video — an open loop at the end is a feature, not a defect.
    const ending = result.findings.find((f) => f.code === "loop_leaves_one_open");
    expect(ending).toBeDefined();
    expect(ending!.ok).toBe(true);
    expect(ending!.detail).toMatch(/1 of 2/);
  });
});

describe("loop thresholds", () => {
  it("exposes its defaults rather than hiding them in the comparison", () => {
    expect(DEFAULT_LOOP_THRESHOLDS.earlyCloseFraction).toBe(0.2);
    expect(DEFAULT_LOOP_THRESHOLDS.lateCloseFraction).toBe(0.9);
  });
});
