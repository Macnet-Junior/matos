/**
 * Grade a transcript against the YouTube skills, and render the result as desk
 * briefing material.
 *
 * This is the layer that turns three separate checkers into one answer. The
 * checkers each look at a different slice of a video and each has its own idea
 * of what "ok" means; run separately, a caller gets three verdicts and has to
 * decide which one matters. `gradeTranscript` runs all three over the same
 * segments and orders them the way a creator fixes them: the hook is the top of
 * the funnel, so a video nobody watches past fifteen seconds has no loop problem
 * worth reporting yet.
 *
 * The ordering is a claim, and it is the important one here. A grade that
 * listed findings in module order would tell a creator to fix a mid-video
 * payoff on a video whose opening is housekeeping — technically true, and
 * useless.
 *
 * What this deliberately does not do: produce a single number. A score out of
 * ten is a summary a creator cannot act on, and it would let a video that fails
 * the hook outright average out to a pass against a strong loop. The grade is
 * ordered findings; the composite verdict is only ever "the first thing wrong".
 */
import type { TranscriptSegment } from "@/lib/desk/sources";
import { checkHook, hookApplicable, HOOK_WINDOW_MS } from "./youtube";
import { checkLoop } from "./youtube-loop";
import { checkPillars, type PillarDefinition } from "./youtube-pillars";

export type GradedSkill = "hook" | "loop" | "pillars";

export type GradeFinding = {
  skill: GradedSkill;
  code: string;
  ok: boolean;
  detail: string;
  atMs: number | null;
  evidence: string | null;
};

export type TranscriptGrade = {
  /** Ordered by what to fix first, which is not module order. */
  findings: GradeFinding[];
  /** True when every skill that could be checked came back clean. */
  ok: boolean;
  /**
   * False when the transcript carries no speech at all. Distinguishes "nothing
   * to read" from "read it and it was short": the two produce the same empty
   * findings list in places, and the renderer must not report a video that was
   * never transcribed as though it had been examined.
   */
  hasSpeech: boolean;
  /**
   * The skill whose failure matters most, or null when nothing failed. This is
   * the only aggregate the grade offers — a creator fixes one thing at a time.
   */
  firstProblem: GradedSkill | null;
  /**
   * Skills that were skipped, and why. A skill that could not run is not the
   * same as a skill that passed, and folding the two together would report a
   * clean bill of health for a video that was never fully examined.
   */
  skipped: Array<{ skill: GradedSkill; reason: string }>;
  transcriptOnly: true;
};

export type GradeOptions = {
  pillars?: PillarDefinition[];
  publishedTopics?: string[];
  /** Passed in when the published runtime is known. */
  durationMs?: number;
};

/**
 * Run every applicable skill over one transcript.
 *
 * Hook first, and it gates the rest on the short-video case: `hookApplicable`
 * refuses a video shorter than the window, and there is no sense grading a loop
 * on a clip that has no opening. Loop runs next because it is about the middle
 * of the video, and Pillars last because it is the only one that needs
 * information from outside the transcript — the channel's own history.
 */
export function gradeTranscript(
  segments: TranscriptSegment[],
  options: GradeOptions = {},
): TranscriptGrade {
  const findings: GradeFinding[] = [];
  const skipped: TranscriptGrade["skipped"] = [];

  // Hook — the top of the funnel, and the only skill with a scope guard.
  //
  // An empty transcript is not a short video. Refusing both through the same
  // branch would report "no opening to grade" for a video nobody transcribed,
  // which is the exact confusion the source layer exists to prevent.
  const hasSpeech = segments.some((s) => s.text.trim().length > 0);
  if (!hasSpeech) {
    skipped.push({
      skill: "hook",
      reason: "The transcript carries no speech, so there is no opening to grade.",
    });
  } else if (hookApplicable(segments)) {
    for (const f of checkHook(segments).findings) {
      findings.push({ skill: "hook", ...f });
    }
  } else {
    skipped.push({
      skill: "hook",
      reason: `The transcript ends before the ${HOOK_WINDOW_MS / 1000}-second hook window closes, so there is no opening to grade.`,
    });
  }

  for (const f of checkLoop(segments, {
    ...(options.durationMs !== undefined ? { durationMs: options.durationMs } : {}),
  }).findings) {
    findings.push({ skill: "loop", ...f });
  }

  const pillars = options.pillars ?? [];
  for (const f of checkPillars(segments, {
    pillars,
    ...(options.publishedTopics ? { publishedTopics: options.publishedTopics } : {}),
  }).findings) {
    findings.push({ skill: "pillars", ...f });
  }

  // A channel with no declared pillars produces one channel-level finding and
  // nothing else useful. Reporting it as a *finding* rather than a skip is
  // deliberate: the missing pillars are a real thing for the owner to fix, not
  // a limitation of the check. It is dropped from `firstProblem` though, so a
  // video with a broken hook still gets sent to fix the hook first — the
  // channel-level gap will still be there tomorrow.
  const firstProblem =
    (findings.find((f) => !f.ok && f.code !== "no_pillars_defined")?.skill ??
      null) as GradedSkill | null;

  return {
    findings,
    ok: findings.every((f) => f.ok),
    hasSpeech,
    firstProblem,
    skipped,
    transcriptOnly: true,
  };
}

/**
 * Render a grade as the marked-up block that goes into a desk brief.
 *
 * The output is written to be *read by a model writing a draft*, and the thing
 * it must not do is present a failed check as advice. A brief that summarised
 * this as "consider tightening your hook" would let the draft stage write a
 * newsletter that never mentions the video's actual opening line. So the block
 * names the failing sentence and its timestamp, and states plainly that these
 * are defects in an existing video rather than instructions for a new one.
 *
 * Returns null when there is nothing gradeable, so a caller cannot append an
 * empty header that reads like a pass.
 */
export function renderGradeForBrief(grade: TranscriptGrade): string | null {
  const failed = grade.findings.filter((f) => !f.ok);
  const passed = grade.findings.filter((f) => f.ok);
  if (grade.findings.length === 0 && grade.skipped.length === 0) return null;

  const lines: string[] = [];
  lines.push(`## Transcript grade (${grade.findings.length} checks run)`);
  lines.push("");

  // No speech at all, which is not a video with a short window — it is a
  // transcript that does not exist, and saying "the opening was skipped" would
  // describe a video nobody transcribed. Keyed on `hasSpeech` rather than on an
  // empty findings list, because Loop and Pillars still return findings over an
  // empty transcript and those would otherwise dress it up as a graded video.
  if (!grade.hasSpeech) {
    lines.push(
      "Nothing graded: the transcript carries no speech, so none of the structural checks had material to read. This is not a pass.",
    );
    for (const s of grade.skipped) {
      lines.push("");
      lines.push(`- [${s.skill}] ${s.reason}`);
    }
    return lines.join("\n");
  }

  lines.push(
    "Structural checks against the channel's own YouTube skills. These are findings about the *existing* video's transcript, not instructions for the draft below.",
  );
  lines.push("");

  if (failed.length > 0) {
    lines.push(`**Failed (${failed.length})**`);
    lines.push("");
    for (const f of failed) {
      const at = f.atMs !== null ? ` @ ${formatSeconds(f.atMs)}` : "";
      lines.push(`- [${f.skill}] ${f.code}${at}: ${f.detail}`);
      if (f.evidence) lines.push(`  > ${f.evidence}`);
    }
    lines.push("");
  }

  if (passed.length > 0) {
    lines.push(`**Passed (${passed.length})**`);
    lines.push("");
    for (const f of passed) {
      // Detail kept short on purpose: the brief does not need the same
      // paragraph a UI would show, and a wall of passing checks buries the
      // failing ones above it.
      lines.push(`- [${f.skill}] ${f.code}`);
    }
    lines.push("");
  }

  if (grade.skipped.length > 0) {
    lines.push("**Not checked**");
    lines.push("");
    for (const s of grade.skipped) {
      lines.push(`- [${s.skill}] ${s.reason}`);
    }
    lines.push("");
  }

  if (grade.firstProblem) {
    lines.push(
      `Fix first: **${grade.firstProblem}**. Everything else in the list is downstream of it.`,
    );
  } else if (failed.length === 0) {
    lines.push(
      "No structural failure found in the transcript. That is not a judgment on whether the video is good — it means the three shapes these checks measure were sound.",
    );
  }

  return lines.join("\n");
}

function formatSeconds(ms: number): string {
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
