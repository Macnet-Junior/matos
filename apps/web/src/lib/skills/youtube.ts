/**
 * YouTube skills — the teaching spine, as checkable rules rather than advice.
 *
 * The three skills that live here (Hook, Loop, Pillars) all come from Macnet's
 * own course material. The point of encoding them is not to restate the lesson
 * in prose — the slides already do that, and a prose restatement is something a
 * model can produce without reading anything. The point is that each one makes
 * a *claim about a specific video* that can be checked against that video's
 * transcript and come back wrong.
 *
 * That is the whole reason these are functions and not markdown. A skill that
 * cannot fail is decoration. `checkHook` can return `ok: false`, and when it
 * does, the reason names the line and the second it failed at — the same
 * contract the transcript renderer already keeps, where a timestamp makes a
 * claim checkable in ten seconds and a wall of prose does not.
 *
 * What this deliberately cannot do: see the video. Everything here reads text.
 * A hook that lands only through a visual — a cut, a face, a prop — is invisible
 * to this module, and every result carries that caveat rather than implying
 * more confidence than the input supports.
 */
import type { TranscriptSegment } from "@/lib/desk/sources";

export const YOUTUBE_SKILLS = ["hook", "loop", "pillars"] as const;
export type YouTubeSkill = (typeof YOUTUBE_SKILLS)[number];

export function isYouTubeSkill(v: string): v is YouTubeSkill {
  return (YOUTUBE_SKILLS as readonly string[]).includes(v);
}

export type SkillFinding = {
  /** Stable identifier so a finding can be discussed, tested, or muted. */
  code: string;
  ok: boolean;
  /** One sentence, plain, about this video — not general advice. */
  detail: string;
  /**
   * Where in the video the finding comes from, when it points at a moment.
   * Null when the finding is about the whole transcript.
   */
  atMs: number | null;
  /** The line the finding was drawn from. Null for whole-transcript findings. */
  evidence: string | null;
};

export type SkillCheckResult = {
  skill: YouTubeSkill;
  ok: boolean;
  findings: SkillFinding[];
  /**
   * Always true today: every check here reads text only. Kept explicit so a
   * caller reading a result knows the visual track was never considered,
   * rather than assuming the video was watched.
   */
  transcriptOnly: true;
};

/** Milliseconds of the opening window a hook has to land in. */
export const HOOK_WINDOW_MS = 15_000;

/**
 * Lines that are housekeeping rather than content.
 *
 * Subscribers, channel furniture, sponsor reads. They are stripped before the
 * hook check because a "welcome back to the channel" is not a hook — it is the
 * thing a hook has to survive. Counting it as an opening would let a video with
 * a strong second sentence pass while the first fifteen seconds were, in fact,
 * a greeting.
 */
const HOUSEKEEPING = [
  /^\s*(hey|hi|hello)\s+(guys|everyone|there|y'?all)\b/i,
  /\bwelcome back\b/i,
  /\bbefore we (get )?(start|started|begin|dive)/i,
  /\b(smash|hit)\s+that\s+(like|subscribe)\b/i,
  /\bsubscribe\b.*\b(bell|channel)\b/i,
  /\b(don'?t forget to)\s+(like|subscribe|hit)\b/i,
  /\bthis video is sponsored\b/i,
  /\bthanks to our sponsor\b/i,
];

export function isHousekeeping(line: string): boolean {
  return HOUSEKEEPING.some((re) => re.test(line));
}

/**
 * Words that signal a concrete claim rather than a generality.
 *
 * A hook is specific or it is nothing. "Most people get this wrong" is a
 * promise about nothing in particular; "I lost $40,000 on this in March" is a
 * promise with a number in it. The check wants the second kind, so it looks for
 * the markers that carry specificity — digits, units, named things — rather
 * than trying to judge whether the sentence is *interesting*, which is a
 * different and much less reliable question.
 */
const SPECIFICITY_SIGNALS: Array<{ code: string; re: RegExp; label: string }> = [
  { code: "number", re: /\b\d[\d,.]*\b/, label: "a number" },
  {
    code: "money",
    re: /[$€£]\s?\d|\b\d[\d,.]*\s?(dollars|bucks|k|grand|usd)\b/i,
    label: "an amount of money",
  },
  {
    code: "timeframe",
    re: /\b(in|after|within|over)\s+(\d+|one|two|three|four|five|six|seven|ten|thirty|sixty)\s+(day|week|month|year|hour|minute|second)s?\b/i,
    label: "a timeframe",
  },
  {
    code: "named_thing",
    re: /\b(youtube|instagram|tiktok|linkedin|stripe|shopify|notion|openai|google|meta)\b/i,
    label: "a named tool or platform",
  },
];

/**
 * Words that make a hedge instead of a claim.
 *
 * Kept short and explicit. These are the openings that promise a topic without
 * promising a reason to stay — the exact failure the Hook skill exists to name.
 */
const HEDGES: Array<{ code: string; re: RegExp; label: string }> = [
  { code: "vague_goal", re: /\b(talk about|discuss|go over|cover|explain)\b/i, label: "\"talk about\"" },
  { code: "generic_audience", re: /\b(many|most|some|a lot of)\s+(people|creators|businesses|folks)\b/i, label: "a vague audience" },
  { code: "self_framing", re: /^\s*(i'?m going to|today i|in this video|let'?s)\b/i, label: "the video introducing itself" },
  { code: "question_only", re: /^\s*(what|why|how|when|who|where)\b[^?]*\?\s*$/i, label: "a bare question" },
];

export type HookWindow = {
  /** The opening line that survived housekeeping, in order. */
  lines: Array<{ text: string; startMs: number }>;
  /** How far into the video the window closed, in ms. */
  closedAtMs: number;
  /** True when no content line existed inside the window at all. */
  emptyWindow: boolean;
};

/**
 * Pull the opening lines that fall inside the hook window.
 *
 * A segment counts if it *starts* inside the window. Something that begins at
 * 14.5s is part of the opening; something that begins at 16s is the body,
 * however far it runs. Using the start rather than the end keeps the window
 * meaning "the first fifteen seconds of speech", which is the thing a viewer
 * experiences.
 */
export function hookWindow(
  segments: TranscriptSegment[],
  windowMs: number = HOOK_WINDOW_MS,
): HookWindow {
  const inside = segments.filter((s) => s.startMs < windowMs);
  const lines = inside
    .map((s) => ({ text: s.text.trim(), startMs: s.startMs }))
    .filter((l) => l.text.length > 0 && !isHousekeeping(l.text));
  return { lines, closedAtMs: windowMs, emptyWindow: lines.length === 0 };
}

function windowMsFrom(segments: TranscriptSegment[]): number {
  // A segment with no end time still marks where speech stops; taking the last
  // known end is the closest an interrupt-style check can get to "the video
  // ended before the hook did".
  const ends = segments.map((s) => s.endMs).filter((n) => Number.isFinite(n));
  return ends.length ? Math.max(...ends) : 0;
}

/**
 * Check whether a video's opening fifteen seconds actually hook.
 *
 * Findings are ordered by what matters, not by how easy they are to compute:
 * an empty window is reported first and short-circuits the rest, because
 * "there was no opening" and "the opening was weak" are different problems and
 * reporting both would blur the one the owner has to fix.
 */
export function checkHook(
  segments: TranscriptSegment[],
): SkillCheckResult {
  const win = hookWindow(segments);
  const findings: SkillFinding[] = [];

  if (win.emptyWindow) {
    // Distinguish the two reasons the window can be empty — a transcript with
    // no speech in the first 15s is a different fix from one whose first 15s
    // was all housekeeping, and saying "no hook" for both would hide which.
    const hadSpeech = segments.some((s) => s.startMs < HOOK_WINDOW_MS && s.text.trim());
    findings.push({
      code: hadSpeech ? "hook_window_is_housekeeping" : "hook_window_empty",
      ok: false,
      detail: hadSpeech
        ? "The first fifteen seconds are housekeeping — a greeting or a subscribe ask — so the video opens with nothing that earns the next thirty seconds."
        : "There is no speech in the first fifteen seconds of this transcript, so there is no hook to check.",
      atMs: 0,
      evidence: null,
    });
    return { skill: "hook", ok: false, findings, transcriptOnly: true };
  }

  const opening = win.lines[0]!;
  const first = opening.text;

  // Finding 1 — does the opening line make a concrete claim?
  const signals = SPECIFICITY_SIGNALS.filter((s) => s.re.test(first));
  const hedges = HEDGES.filter((h) => h.re.test(first));
  const specific = signals.length > 0 && hedges.length === 0;

  findings.push({
    code: specific ? "hook_specific" : "hook_vague",
    ok: specific,
    detail: specific
      ? `The opening line is concrete — it carries ${signals.map((s) => s.label).join(" and ")}.`
      : hedges.length > 0
        ? `The opening line makes no concrete claim: it relies on ${hedges.map((h) => h.label).join(" and ")} instead of a number, a timeframe, or a named thing.`
        : "The opening line makes no concrete claim — no number, amount, timeframe, or named thing appears in it.",
    atMs: opening.startMs,
    evidence: first,
  });

  // Finding 2 — is the hook concentrated in one line, or does it only emerge
  // once several lines have run together? A hook spread across four sentences
  // is not an opening, it is a slow start that happens to end well.
  const cited = win.lines.find(
    (l) => SPECIFICITY_SIGNALS.some((s) => s.re.test(l.text)) && !hedges.some((h) => h.re.test(l.text)),
  );
  if (cited && cited.startMs !== opening.startMs) {
    findings.push({
      code: "hook_delayed",
      ok: false,
      detail: `The first concrete claim does not arrive until ${formatSeconds(cited.startMs)} — inside the window, but after the opening line has already spent the viewer's attention.`,
      atMs: cited.startMs,
      evidence: cited.text,
    });
  } else if (cited) {
    findings.push({
      code: "hook_immediate",
      ok: true,
      detail: "The concrete claim is the first thing said — nothing is spent before it.",
      atMs: cited.startMs,
      evidence: cited.text,
    });
  }

  // Finding 3 — does the video leave the claim unresolved long enough to be
  // worth staying for? Paying it off in the same breath is a summary, not a hook.
  const paidOffInWindow = win.lines
    .slice(1)
    .some((l) => FINALITY.some((re) => re.test(l.text)) || SPECIFICITY_SIGNALS.some((s) => s.re.test(l.text)));
  findings.push({
    code: paidOffInWindow ? "hook_paid_too_early" : "hook_open_loop",
    ok: !paidOffInWindow,
    detail: paidOffInWindow
      ? "The opening claim is resolved inside the same window, so there is no open question left to hold a viewer past fifteen seconds."
      : "The opening claim is left unresolved inside the window — there is a reason to keep watching.",
    atMs: win.lines[0]!.startMs,
    evidence: win.lines.length > 1 ? win.lines[1]!.text : null,
  });

  return {
    skill: "hook",
    ok: findings.every((f) => f.ok),
    findings,
    transcriptOnly: true,
  };
}

/** Phrases that close a loop rather than open one. */
const FINALITY = [
  /\bthat'?s (it|all|why)\b/i,
  /\bin short\b/i,
  /\bthe answer is\b/i,
  /\bso,? (that'?s|basically)\b/i,
];

function formatSeconds(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Hook's companion: is this video long enough for a hook to matter?
 *
 * Not a quality judgment — a scope guard. The Hook skill's fifteen-second rule
 * comes from the format where a viewer can leave at any moment. An eight-second
 * video has no first fifteen seconds, and applying the rule to one would
 * produce a confident finding about a window that does not exist.
 */
export function hookApplicable(segments: TranscriptSegment[]): boolean {
  return windowMsFrom(segments) >= HOOK_WINDOW_MS;
}
