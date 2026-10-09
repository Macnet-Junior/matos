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
  parsePastedTranscript,
  parseYouTubeUrl,
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

function titleFor(input: { title?: string; youtubeUrl?: string; transcript?: string }): string {
  const given = input.title?.trim() ?? "";
  if (given.length >= 2) return given.slice(0, 160);
  if (input.youtubeUrl) {
    const parsed = parseYouTubeUrl(input.youtubeUrl);
    if (parsed.ok) return `YouTube ${parsed.videoId}`;
  }
  return "Pasted transcript";
}

export async function startYoutubeSkill(input: {
  jobId: string;
  actorEmail: string;
  title?: string;
  youtubeUrl?: string;
  transcript?: string;
  deps?: DraftSkillDeps;
}): Promise<YoutubeSkillOutcome> {
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
  let kind: SourceKind = "video";
  let inputText = "";
  if (youtubeUrl) {
    const parsed = parseYouTubeUrl(youtubeUrl);
    if (!parsed.ok) throw new YoutubeSkillInputError(parsed.reason);
    origin = parsed.url;
  } else {
    const segments = parsePastedTranscript(transcript);
    if (segments.length === 0) {
      throw new YoutubeSkillInputError(
        "Paste the transcript or the words from the video. A blank note cannot become a skill.",
      );
    }
    origin = "Pasted transcript";
    inputText = transcript;
    kind = "video";
  }

  const created = await createDeskSource({
    kind,
    title: titleFor(input),
    origin,
    jobId: job.id,
    actorEmail: input.actorEmail,
  });
  if (inputText) {
    await prisma.deskSource.update({
      where: { id: created.id },
      data: { inputText },
    });
  }
  return applyDraft({
    sourceId: created.id,
    actorEmail: input.actorEmail,
    deps: input.deps,
  });
}

export async function retryYoutubeSkill(input: {
  sourceId: string;
  actorEmail: string;
  deps?: DraftSkillDeps;
}): Promise<YoutubeSkillOutcome> {
  const existing = await prisma.deskSource.findUnique({ where: { id: input.sourceId } });
  if (!existing || existing.createdBy !== input.actorEmail) {
    throw new YoutubeSkillInputError("Source not found");
  }
  if (existing.status === "transcribed" && existing.skillReadiness === "draft") {
    throw new YoutubeSkillInputError("This draft is already done. Paste the link again to make another one.");
  }
  return applyDraft({
    sourceId: existing.id,
    actorEmail: input.actorEmail,
    deps: input.deps,
  });
}
