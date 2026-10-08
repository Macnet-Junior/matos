/**
 * The Loop skill — did the video earn the time it asked for?
 *
 * Hook asks whether a video opens well. Loop asks the harder question the
 * slides actually push: whether the video *keeps* the promise the hook made.
 * The two fail differently. A video with a bad hook loses everyone in fifteen
 * seconds; a video with a broken loop holds a viewer to the two-minute mark and
 * then gives them nothing, which is worse for the channel because the watch
 * time is spent and the payoff never lands.
 *
 * Everything here is structural: where the open questions are, where they get
 * answered, and whether the ending points anywhere. It reads text and cannot
 * judge whether the payoff was *satisfying* — a video can close every loop it
 * opened and still be dull. The findings are about shape, and they say so.
 */
import type { TranscriptSegment } from "@/lib/desk/sources";

export type LoopFinding = {
  code: string;
  ok: boolean;
  detail: string;
  atMs: number | null;
  evidence: string | null;
};

export type LoopCheckResult = {
  skill: "loop";
  ok: boolean;
  findings: LoopFinding[];
  /** Open questions found, in the order they were raised. */
  opened: Array<{ text: string; startMs: number }>;
  /** Payoffs found, in the order they arrived. */
  closed: Array<{ text: string; startMs: number }>;
  transcriptOnly: true;
};

/**
 * Phrases that raise a question the viewer now wants answered.
 *
 * These are the explicit ones — the sentence that *says* something is coming.
 * Implicit promises ("I lost $40,000") are left out on purpose: inferring that
 * a statement implies a later payoff is a judgment about meaning, and a checker
 * that guesses at meaning produces confident findings about intent it cannot
 * actually read. Explicit markers are checkable; inferred ones are not.
 */
const OPEN_MARKERS: Array<{ code: string; re: RegExp; label: string }> = [
  { code: "coming_up", re: /\b(coming up|stay with me|stick around|in a (sec|second|minute|moment))\b/i, label: "\"coming up\"" },
  { code: "will_show", re: /\b(i'?ll (show|tell|explain|walk) you|we'?ll (get to|cover|come back to))\b/i, label: "a promised explanation" },
  { code: "numbered_promise", re: /\b(\d+|two|three|four|five|six|seven|ten)\s+(things|ways|steps|reasons|mistakes|rules|tips)\b/i, label: "a numbered list promised" },
  { code: "later", re: /\b(at the end|by the end|the (last|final) (one|thing|step)|i'?ll come back)\b/i, label: "a payoff deferred to later" },
  { code: "hold_question", re: /^\s*(so |but |and )?(why|how|what)\b[^.!?]*\?\s*$/i, label: "a question left hanging" },
];

/**
 * Phrases that mark a payoff landing.
 *
 * Short and literal for the same reason as the open markers: a payoff is real
 * when the transcript says so, not when a model feels the paragraph resolved.
 */
const CLOSE_MARKERS: Array<{ code: string; re: RegExp; label: string }> = [
  { code: "heres_why", re: /\b(here'?s (why|how|what|the))\b/i, label: "\"here's why\"" },
  { code: "the_answer", re: /\b(the (answer|reason|point) is|and that'?s (why|how))\b/i, label: "\"the answer is\"" },
  { code: "turns_out", re: /\b(it turns out|the truth is|what actually happened)\b/i, label: "\"it turns out\"" },
  { code: "so_that", re: /\bso that'?s (why|how|what)\b/i, label: "\"so that's why\"" },
];

export type LoopThresholds = {
  /** Fraction of the video that must pass before an early loop closes. */
  earlyCloseFraction: number;
  /** How close to the end a payoff may land and still count as landing. */
  lateCloseFraction: number;
};

export const DEFAULT_LOOP_THRESHOLDS: LoopThresholds = {
  // A loop that closes in the first fifth of the video is closing before the
  // viewer has decided to stay. The number is a convention, not a law, so it is
  // a parameter rather than a constant baked into the comparison.
  earlyCloseFraction: 0.2,
  // A payoff in the last tenth is a payoff after the audience has already left.
  lateCloseFraction: 0.9,
};

export type LoopOptions = {
  thresholds?: Partial<LoopThresholds>;
  /** Passed in when known; when absent, the end of speech is used. */
  durationMs?: number;
};

export function checkLoop(
  segments: TranscriptSegment[],
  options: LoopOptions = {},
): LoopCheckResult {
  const thresholds = { ...DEFAULT_LOOP_THRESHOLDS, ...options.thresholds };
  const durationMs = options.durationMs ?? endOfSpeech(segments);
  const findings: LoopFinding[] = [];

  const opened = segments
    .filter((s) => OPEN_MARKERS.some((m) => m.re.test(s.text)))
    .map((s) => ({ text: s.text.trim(), startMs: s.startMs }));
  const closed = segments
    .filter((s) => CLOSE_MARKERS.some((m) => m.re.test(s.text)))
    .map((s) => ({ text: s.text.trim(), startMs: s.startMs }));

  if (opened.length === 0) {
    // Not automatically a failure — an explainer that raises no explicit
    // question can still hold attention. But the loop skill has nothing to say
    // about it, and saying "pass" would be a claim the check cannot support.
    findings.push({
      code: "no_explicit_loops",
      ok: true,
      detail:
        "No explicit open question was raised — no \"coming up\", no promised list, no deferred payoff. The video may hold attention on structure alone, but there is no loop for this skill to grade.",
      atMs: null,
      evidence: null,
    });
    return { skill: "loop", ok: true, findings, opened, closed, transcriptOnly: true };
  }

  // Finding 1 — does anything actually close? An opening promise with no
  // payoff is the worst shape: the time was spent and nothing was delivered.
  if (closed.length === 0) {
    findings.push({
      code: "loop_never_closes",
      ok: false,
      detail: `The video raises ${opened.length} open question${opened.length === 1 ? "" : "s"} and no payoff marker appears anywhere in the transcript.`,
      atMs: opened[0]!.startMs,
      evidence: opened[0]!.text,
    });
    return {
      skill: "loop",
      ok: false,
      findings,
      opened,
      closed,
      transcriptOnly: true,
    };
  }

  // Finding 2 — the order. A payoff that lands before its question leaves the
  // viewer holding an answer to something they have not been asked yet, so they
  // have to keep the answer in their head until the question arrives. That is
  // the structure working backwards.
  let earliestRethink: LoopFinding | null = null;
  for (const open of opened) {
    const payoff = closed.find((c) => c.startMs > open.startMs);
    if (!payoff && durationMs > 0) {
      earliestRethink = {
        code: "loop_unanswered",
        ok: false,
        detail: `The question raised at ${formatSeconds(open.startMs)} is never answered after it is raised — the video ends with it still open.`,
        atMs: open.startMs,
        evidence: open.text,
      };
      break;
    }
  }
  if (earliestRethink) findings.push(earliestRethink);

  const firstOpen = opened[0]!;
  const firstClose = closed.find((c) => c.startMs > firstOpen.startMs) ?? closed[0]!;

  // Finding 3 — does the first payoff land too early to have been worth
  // waiting for, or too late to reach anyone?
  if (durationMs > 0) {
    const fraction = firstClose.startMs / durationMs;
    if (fraction < thresholds.earlyCloseFraction) {
      findings.push({
        code: "loop_closed_too_early",
        ok: false,
        detail: `The first payoff lands at ${formatSeconds(firstClose.startMs)}, inside the first ${Math.round(thresholds.earlyCloseFraction * 100)}% of the video — before a viewer has committed to staying.`,
        atMs: firstClose.startMs,
        evidence: firstClose.text,
      });
    } else if (fraction >= thresholds.lateCloseFraction) {
      findings.push({
        code: "loop_closed_too_late",
        ok: false,
        detail: `The first payoff lands at ${formatSeconds(firstClose.startMs)}, in the last ${Math.round((1 - thresholds.lateCloseFraction) * 100)}% of the video — after most of the audience has already gone.`,
        atMs: firstClose.startMs,
        evidence: firstClose.text,
      });
    } else {
      findings.push({
        code: "loop_payoff_placed",
        ok: true,
        detail: `The first payoff lands at ${formatSeconds(firstClose.startMs)}, past the opening and short of the end.`,
        atMs: firstClose.startMs,
        evidence: firstClose.text,
      });
    }
  }

  // Finding 4 — is anything left open at the end to carry a viewer onward?
  //
  // A question counts as answered only when a payoff lands while that question
  // is still the *current* one — that is, before the next question is raised.
  // The looser test ("some payoff exists anywhere after it") counts a payoff
  // that answers question two as an answer to question one simply because it
  // came later, which silently marks every question answered and makes this
  // finding unreachable.
  const soonestNextOpen = (index: number): number => {
    const later = opened.slice(index + 1).map((o) => o.startMs);
    return later.length ? Math.min(...later) : Number.POSITIVE_INFINITY;
  };
  const answered = opened.filter((o, i) =>
    closed.some((c) => c.startMs > o.startMs && c.startMs < soonestNextOpen(i)),
  );
  const stillOpen = opened.length - answered.length;
  findings.push({
    code: stillOpen > 0 ? "loop_leaves_one_open" : "loop_fully_closed",
    ok: true,
    detail:
      stillOpen > 0
        ? `${stillOpen} of ${opened.length} questions are left unresolved at the end — there is somewhere for a viewer to go next.`
        : "Every question raised is answered by the end, so nothing carries a viewer into the next video.",
    atMs: durationMs > 0 ? durationMs : null,
    evidence: null,
  });

  return {
    skill: "loop",
    ok: findings.every((f) => f.ok),
    findings,
    opened,
    closed,
    transcriptOnly: true,
  };
}

function endOfSpeech(segments: TranscriptSegment[]): number {
  const ends = segments.map((s) => s.endMs).filter((n) => Number.isFinite(n));
  return ends.length ? Math.max(...ends) : 0;
}

function formatSeconds(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
