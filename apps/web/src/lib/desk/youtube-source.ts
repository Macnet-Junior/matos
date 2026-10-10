/**
 * Desk's side of YouTube-to-skill.
 *
 * The Gemini call lives in Skillwright (`draftSkillFromInput`). This file
 * stores the outcome on a desk source and runs the existing transcript grade.
 * It does not call Gemini, and it does not write a MatOS skill row.
 *
 * A failed call or a bad parse leaves the source failed and the skill fields
 * empty. That source stays retryable. It is never transcribed, and it is never
 * a watched or approved skill. There is no fallback that turns the failure
 * into a draft.
 */

import { prisma } from "@matos/db";
import { appendActivity } from "@/lib/map-data";
import { gradeTranscript, type TranscriptGrade } from "@/lib/skills/grade";
import {
  draftSkillFromInput,
  geminiConfigured,
  parsePastedTranscript,
  parseYouTubeUrl,
  YOUTUBE_READ_TIMEOUT_MS,
  YOUTUBE_TIMEOUT_MESSAGE,
  type DraftSkillDeps,
  type DraftSkillResult,
} from "skillwright/youtube-skill";
import {
  createDeskSource,
  renderTranscript,
  sourceSegments,
  toDeskSourceDTO,
  type DeskSourceDTO,
  type SourceKind,
} from "./sources";

export class YoutubeSkillInputError extends Error {}

export type SourceGradeView = {
  ok: boolean;
  hasSpeech: boolean;
  firstProblem: TranscriptGrade["firstProblem"];
  findings: Array<{
    skill: string;
    ok: boolean;
    code: string;
    detail: string;
  }>;
  skipped: TranscriptGrade["skipped"];
};

export type YoutubeSkillOutcome = {
  source: DeskSourceDTO;
  grade: SourceGradeView | null;
};

/**
 * `source` is what the panel can show right away. `settled` finishes when
 * Gemini does. The HTTP route returns `source` and does not wait on `settled`,
 * so a normal video does not hold the request open until the abort fires.
 */
export type YoutubeSkillStart = YoutubeSkillOutcome & {
  settled: Promise<YoutubeSkillOutcome>;
};

export const PASTED_TRANSCRIPT_ORIGIN = "Pasted transcript";

const ABANDONED_READ_MESSAGE =
  "The read stopped before it finished. Nothing was saved. Try again.";

const inflight = new Map<string, Promise<YoutubeSkillOutcome>>();
const processStartedAt = Date.now();

function gradeView(grade: TranscriptGrade): SourceGradeView {
  return {
    ok: grade.ok,
    hasSpeech: grade.hasSpeech,
    firstProblem: grade.firstProblem,
    findings: grade.findings.map((finding) => ({
      skill: finding.skill,
      ok: finding.ok,
      code: finding.code,
      detail: finding.detail,
    })),
    skipped: grade.skipped,
  };
}

export async function gradeForSource(sourceId: string): Promise<SourceGradeView | null> {
  const material = await sourceSegments(sourceId);
  if (!material) return null;
  return gradeView(
    gradeTranscript(material.segments, {
      ...(material.durationMs !== null ? { durationMs: material.durationMs } : {}),
    }),
  );
}

export async function attachSourceGrades(
  sources: DeskSourceDTO[],
): Promise<Array<DeskSourceDTO & { grade: SourceGradeView | null }>> {
  const graded = [];
  for (const source of sources) {
    graded.push({
      ...source,
      grade: source.status === "transcribed" ? await gradeForSource(source.id) : null,
    });
  }
  return graded;
}

function isUsableDraft(result: DraftSkillResult): result is Extract<DraftSkillResult, { ok: true }> {
  return (
    result.ok === true &&
    result.watched === false &&
    result.readiness === "draft" &&
    result.skillMarkdown.trim().length > 0 &&
    result.segments.some((segment) => segment.text.trim())
  );
}

function beginRead(
  sourceId: string,
  work: Promise<YoutubeSkillOutcome>,
): Promise<YoutubeSkillOutcome> {
  const slot: { current: Promise<YoutubeSkillOutcome> | null } = { current: null };
  const guarded = work
    .catch(async () => {
      try {
        const source = await clearToFailed(
          sourceId,
          "Could not reach Gemini. Check the connection and try again. Nothing was saved.",
        );
        return { source, grade: null };
      } catch {
        return {
          source: {
            id: sourceId,
            jobId: null,
            kind: "video" as const,
            title: "",
            origin: "",
            status: "failed" as const,
            provider: "",
            language: null,
            durationMs: null,
            transcript: "",
            segmentCount: 0,
            skillName: "",
            skillDraft: "",
            skillReadiness: "unfinished" as const,
            error: "Could not reach Gemini. Check the connection and try again. Nothing was saved.",
            createdBy: "",
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          },
          grade: null,
        };
      }
    })
    .finally(() => {
      if (slot.current && inflight.get(sourceId) === slot.current) inflight.delete(sourceId);
    });
  slot.current = guarded;
  inflight.set(sourceId, guarded);
  return guarded;
}

async function finishRead(
  snapshot: DeskSourceDTO,
  work: Promise<YoutubeSkillOutcome>,
  background: boolean,
): Promise<YoutubeSkillStart> {
  const settled = beginRead(snapshot.id, work);
  if (!background) {
    const outcome = await settled;
    return { ...outcome, settled: Promise.resolve(outcome) };
  }
  return { source: snapshot, grade: null, settled };
}

/**
 * A processing row whose read is not running in this process is abandoned
 * (the dev server restarted) or past the budget. Either way it becomes failed
 * and retryable. A read that is still in flight is left alone.
 */
export async function reapAbandonedYoutubeReads(
  owner: string,
  opts?: { now?: number; processStartedAt?: number },
): Promise<void> {
  const now = opts?.now ?? Date.now();
  const started = opts?.processStartedAt ?? processStartedAt;
  const deadline = now - YOUTUBE_READ_TIMEOUT_MS - 15_000;
  const rows = await prisma.deskSource.findMany({
    where: { createdBy: owner, status: "processing" },
  });
  for (const row of rows) {
    if (inflight.has(row.id)) continue;
    const updatedAt = row.updatedAt.getTime();
    // A row left processing by a previous process (dev server restart) is not
    // in `inflight`. One this process started has a later updatedAt.
    const diedWithProcess = updatedAt < started;
    const overdue = updatedAt < deadline;
    if (!diedWithProcess && !overdue) continue;
    await clearToFailed(row.id, diedWithProcess && !overdue ? ABANDONED_READ_MESSAGE : YOUTUBE_TIMEOUT_MESSAGE);
  }
}

async function clearToFailed(sourceId: string, reason: string): Promise<DeskSourceDTO> {
  const failed = await prisma.deskSource.update({
    where: { id: sourceId },
    data: {
      status: "failed",
      error: reason,
      provider: "",
      transcript: "",
      segmentsJson: "[]",
      language: null,
      durationMs: null,
      skillDraft: "",
      skillName: "",
      skillReadiness: "unfinished",
    },
  });
  return toDeskSourceDTO(failed);
}

async function applyDraft(input: {
  sourceId: string;
  actorEmail: string;
  deps?: DraftSkillDeps;
}): Promise<YoutubeSkillOutcome> {
  const existing = await prisma.deskSource.findUnique({ where: { id: input.sourceId } });
  if (!existing) throw new YoutubeSkillInputError("Source not found");
  if (existing.createdBy !== input.actorEmail) {
    throw new YoutubeSkillInputError("Source not found");
  }

  const youtube = parseYouTubeUrl(existing.origin);
  const transcript = existing.inputText.trim();
  if (!youtube.ok && !transcript) {
    throw new YoutubeSkillInputError(
      "This source has nothing to retry. Paste the YouTube link or the transcript again.",
    );
  }

  await prisma.deskSource.update({
    where: { id: existing.id },
    data: { status: "processing", error: null },
  });

  let result: DraftSkillResult;
  try {
    result = await draftSkillFromInput(
      youtube.ok
        ? { mode: "youtube", url: youtube.url }
        : { mode: "transcript", text: transcript, title: existing.title },
      input.deps,
    );
  } catch {
    const source = await clearToFailed(
      existing.id,
      "Could not reach Gemini. Check the connection and try again. Nothing was saved.",
    );
    return { source, grade: null };
  }

  if (!isUsableDraft(result)) {
    const reason = result.ok
      ? "Gemini replied, but it was not a skill. Nothing was saved. Try again."
      : result.reason;
    const source = await clearToFailed(existing.id, reason);
    return { source, grade: null };
  }

  const rendered = renderTranscript({
    text: result.segments.map((segment) => segment.text).join(" "),
    segments: result.segments,
    language: result.language,
    durationMs: result.durationMs,
    provider: result.provider,
  });
  if (!rendered.trim()) {
    const source = await clearToFailed(
      existing.id,
      "Gemini replied, but it was not a skill. Nothing was saved. Try again.",
    );
    return { source, grade: null };
  }

  const saved = await prisma.deskSource.update({
    where: { id: existing.id },
    data: {
      status: "transcribed",
      provider: result.provider,
      language: result.language,
      durationMs: result.durationMs,
      transcript: rendered,
      segmentsJson: JSON.stringify(result.segments),
      skillDraft: result.skillMarkdown,
      skillName: result.skillName,
      skillReadiness: "draft",
      error: null,
    },
  });

  await appendActivity({
    action: "desk.source.skill_drafted",
    entityType: "desk_source",
    entityId: saved.id,
    summary: `Drafted skill "${result.skillName}" (not watched)`,
    actorEmail: input.actorEmail,
    payload: { provider: result.provider, readiness: "draft" },
  });

  const source = toDeskSourceDTO(saved);
  return { source, grade: await gradeForSource(source.id) };
}

function titleFor(
  givenTitle: string | undefined,
  video: { videoId: string } | null,
): string {
  const given = givenTitle?.trim() ?? "";
  const givenIsLink = given.length > 0 && parseYouTubeUrl(given).ok;
  if (video) {
    if (given.length >= 2 && !givenIsLink) return given.slice(0, 160);
    return `YouTube ${video.videoId}`;
  }
  if (given.length >= 2 && !givenIsLink) return given.slice(0, 160);
  return PASTED_TRANSCRIPT_ORIGIN;
}

/**
 * A transcript box that contains only a YouTube address (or the share-sheet
 * blurb around one) is a YouTube source. A real transcript that mentions a
 * link in passing stays a transcript.
 */
function transcriptIsOnlyALink(text: string): { url: string; videoId: string } | null {
  const parsed = parseYouTubeUrl(text);
  if (!parsed.ok) return null;
  const stripped = text
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/(?:^|\s)(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/\S+/gi, " ")
    .replace(/["'<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length > 80) return null;
  return parsed;
}

export async function startYoutubeSkill(input: {
  jobId: string;
  actorEmail: string;
  title?: string;
  youtubeUrl?: string;
  transcript?: string;
  deps?: DraftSkillDeps;
  /** Wait for Gemini before returning. The route leaves this unset so the panel can show Processing. */
  awaitResult?: boolean;
}): Promise<YoutubeSkillStart> {
  const youtubeUrl = input.youtubeUrl?.trim() ?? "";
  const transcript = input.transcript?.trim() ?? "";
  if (youtubeUrl && transcript) {
    throw new YoutubeSkillInputError("Paste a YouTube link or a transcript, not both.");
  }
  if (!youtubeUrl && !transcript) {
    throw new YoutubeSkillInputError("Paste a YouTube link or a transcript.");
  }

  const job = await prisma.deskJob.findUnique({ where: { id: input.jobId } });
  if (!job) throw new YoutubeSkillInputError("Desk job not found");

  let origin = "";
  const kind: SourceKind = "video";
  let inputText = "";
  let video: { url: string; videoId: string } | null = null;
  if (youtubeUrl) {
    const parsed = parseYouTubeUrl(youtubeUrl);
    if (!parsed.ok) throw new YoutubeSkillInputError(parsed.reason);
    video = parsed;
    origin = parsed.url;
  } else {
    const asLink = transcriptIsOnlyALink(transcript);
    if (asLink) {
      video = asLink;
      origin = asLink.url;
    } else {
      const segments = parsePastedTranscript(transcript);
      if (segments.length === 0) {
        throw new YoutubeSkillInputError(
          "Paste the transcript or the words from the video. A blank note cannot become a skill.",
        );
      }
      origin = PASTED_TRANSCRIPT_ORIGIN;
      inputText = transcript;
    }
  }

  const created = await createDeskSource({
    kind,
    title: titleFor(input.title, video),
    origin,
    jobId: job.id,
    actorEmail: input.actorEmail,
  });
  const processing = await prisma.deskSource.update({
    where: { id: created.id },
    data: {
      status: "processing",
      error: null,
      ...(inputText ? { inputText } : {}),
    },
  });
  const snapshot = toDeskSourceDTO(processing);
  const env = input.deps?.env ?? process.env;
  const background = input.awaitResult !== true && geminiConfigured(env);
  return finishRead(
    snapshot,
    applyDraft({
      sourceId: created.id,
      actorEmail: input.actorEmail,
      deps: input.deps,
    }),
    background,
  );
}

export async function retryYoutubeSkill(input: {
  sourceId: string;
  actorEmail: string;
  deps?: DraftSkillDeps;
  /** Wait for Gemini before returning. The route leaves this unset so the panel can show Processing. */
  awaitResult?: boolean;
}): Promise<YoutubeSkillStart> {
  const existing = await prisma.deskSource.findUnique({ where: { id: input.sourceId } });
  if (!existing || existing.createdBy !== input.actorEmail) {
    throw new YoutubeSkillInputError("Source not found");
  }
  if (existing.status === "transcribed" && existing.skillReadiness === "draft") {
    throw new YoutubeSkillInputError("This draft is already done. Paste the link again to make another one.");
  }
  if (existing.status === "processing" && inflight.has(existing.id)) {
    throw new YoutubeSkillInputError(
      "That video is still being read. Wait until it finishes, then try again if it fails.",
    );
  }
  const processing = await prisma.deskSource.update({
    where: { id: existing.id },
    data: { status: "processing", error: null },
  });
  const snapshot = toDeskSourceDTO(processing);
  const env = input.deps?.env ?? process.env;
  const background = input.awaitResult !== true && geminiConfigured(env);
  return finishRead(
    snapshot,
    applyDraft({
      sourceId: existing.id,
      actorEmail: input.actorEmail,
      deps: input.deps,
    }),
    background,
  );
}
