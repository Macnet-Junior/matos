import { prisma } from "@matos/db";
import { appendActivity } from "@/lib/map-data";
import { recordUsageEvent } from "@/lib/ops/usage";
import type { DeskOwner } from "./index";

/**
 * Ingest — turning material the owner already made into a desk brief.
 *
 * The gap this closes is the proof gap. The desk can draft, but a draft is
 * only as good as what it was briefed with, and the best brief the owner has
 * is usually something he already said out loud: a video, a call recording, a
 * voice note. Those are the material that carries specifics — numbers, names,
 * the actual objection — which is exactly what a model cannot invent and what
 * a generic draft is missing.
 *
 * So the unit here is not "a transcript". It is a **source**: a piece of the
 * owner's own material, with its raw text kept, and the desk briefed from it.
 * Keeping the raw text is the point. A brief derived from a source stays
 * traceable to it, so a claim in a draft can be checked against the sentence
 * it came from — which is the difference between a proof and a plausible
 * sentence.
 */

export const SOURCE_KINDS = [
  "video",
  "audio",
  "article",
  "doc",
  "call",
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export function isSourceKind(v: string): v is SourceKind {
  return (SOURCE_KINDS as readonly string[]).includes(v);
}

/**
 * `pending` is a real state, not an error state.
 *
 * A transcript that failed is `failed` and can be retried. A transcript that
 * has not run yet is `pending`, and a brief must never be built from it — an
 * empty transcript is the most dangerous kind, because it produces a
 * confident draft with nothing behind it.
 */
export const SOURCE_STATUSES = [
  "pending",
  "transcribed",
  "failed",
] as const;

export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** One segment of a transcript, with the timestamps a citation needs. */
export type TranscriptSegment = {
  /** Milliseconds from the start of the media. */
  startMs: number;
  endMs: number;
  text: string;
};

export type TranscriptResult = {
  text: string;
  segments: TranscriptSegment[];
  /** `en`, `ru`, or whatever the provider detected. */
  language: string | null;
  durationMs: number | null;
  /**
   * Which engine produced this, and whether it was a real one.
   *
   * `placeholder` means the text is derived from the filename and is not a
   * transcript of anything. It is recorded so a caller can refuse to brief
   * from it — the single worst outcome in this file is a fake transcript
   * being treated as the owner's own words.
   */
  provider: string;
};

export interface TranscriptionProvider {
  transcribe(input: {
    filePath: string;
    kind: SourceKind;
    title: string;
  }): Promise<TranscriptResult>;
}

/**
 * The provider used when no transcription API key is configured.
 *
 * It deliberately does **not** invent speech. A placeholder transcript that
 * reads like a plausible talk would be indistinguishable downstream from a
 * real one, and the desk would brief from it and publish the owner's
 * invented words back to him as if they were his. So this returns the empty
 * string with `provider: "placeholder"`, and the guard in `ingestSource`
 * refuses to mark it transcribed. No material means no brief, which is
 * visible and fixable; a fabricated brief is neither.
 */
export class PlaceholderTranscriptionProvider implements TranscriptionProvider {
  async transcribe(input: {
    filePath: string;
    kind: SourceKind;
    title: string;
  }): Promise<TranscriptResult> {
    return {
      text: "",
      segments: [],
      language: null,
      durationMs: null,
      provider: "placeholder",
    };
  }
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Render a transcript as citable markdown.
 *
 * Timestamps are kept because a draft that says "at 04:12 he explains why the
 * price went up" can be checked by the owner in ten seconds, and a wall of
 * prose cannot. This is the mechanism that makes a draft *provable* rather
 * than merely agreeable.
 */
export function renderTranscript(result: TranscriptResult): string {
  const header = [
    result.provider === "placeholder"
      ? "> Untranscribed — placeholder provider, no speech was processed."
      : null,
    result.language ? `Language: ${result.language}` : null,
    result.durationMs ? `Duration: ${formatTimestamp(result.durationMs)}` : null,
  ].filter(Boolean);

  const lines = result.segments.length
    ? result.segments.map((s) => `[${formatTimestamp(s.startMs)}] ${s.text}`)
    : result.text
      ? [result.text]
      : [];

  return [...header, ...(header.length && lines.length ? [""] : []), ...lines].join(
    "\n",
  );
}

export type DeskSourceDTO = {
  id: string;
  jobId: string | null;
  kind: SourceKind;
  title: string;
  /** Where the material came from — a URL, a path, a description. */
  origin: string;
  status: SourceStatus;
  provider: string;
  language: string | null;
  durationMs: number | null;
  transcript: string;
  segmentCount: number;
  error: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type SourceRow = {
  id: string;
  jobId: string | null;
  kind: string;
  title: string;
  origin: string;
  status: string;
  provider: string;
  language: string | null;
  durationMs: number | null;
  transcript: string;
  segmentsJson: string;
  error: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

function asSourceStatus(v: string): SourceStatus {
  return (SOURCE_STATUSES as readonly string[]).includes(v)
    ? (v as SourceStatus)
    : "pending";
}

export function toDeskSourceDTO(row: SourceRow): DeskSourceDTO {
  let segments: TranscriptSegment[] = [];
  try {
    const parsed = JSON.parse(row.segmentsJson);
    if (Array.isArray(parsed)) segments = parsed;
  } catch {
    segments = [];
  }
  return {
    id: row.id,
    jobId: row.jobId,
    kind: isSourceKind(row.kind) ? row.kind : "doc",
    title: row.title,
    origin: row.origin,
    status: asSourceStatus(row.status),
    provider: row.provider,
    language: row.language,
    durationMs: row.durationMs,
    transcript: row.transcript,
    segmentCount: segments.length,
    error: row.error,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const sourceInclude = {};

export async function createDeskSource(input: {
  kind: SourceKind;
  title: string;
  origin: string;
  jobId?: string | null;
  actorEmail: string;
}): Promise<DeskSourceDTO> {
  const row = await prisma.deskSource.create({
    data: {
      kind: input.kind,
      title: input.title,
      origin: input.origin,
      jobId: input.jobId ?? null,
      createdBy: input.actorEmail,
    },
  });
  return toDeskSourceDTO(row);
}

/**
 * Run transcription over a source and store what came back.
 *
 * The refusal matters more than the success. `ingestSource` marks the row
 * `transcribed` only when a provider actually returned speech; the placeholder
 * provider returns none, so the row stays `pending` with an explanation. The
 * alternative — accepting an empty transcript as success — would let the desk
 * brief from nothing and call the result the owner's own words.
 *
 * Note the ordering: the usage event is written *after* a real transcript
 * exists, never before. A run that produced nothing is not a run the user
 * was provided.
 */
export async function ingestSource(input: {
  sourceId: string;
  filePath: string;
  actorEmail: string;
  provider?: TranscriptionProvider;
}): Promise<DeskSourceDTO> {
  const existing = await prisma.deskSource.findUnique({
    where: { id: input.sourceId },
  });
  if (!existing) throw new Error("Source not found");

  const provider = input.provider ?? getTranscriptionProvider();

  let result: TranscriptResult;
  try {
    result = await provider.transcribe({
      filePath: input.filePath,
      kind: isSourceKind(existing.kind) ? existing.kind : "doc",
      title: existing.title,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    const failed = await prisma.deskSource.update({
      where: { id: existing.id },
      data: { status: "failed", error: message, provider: providerName(provider) },
    });
    return toDeskSourceDTO(failed);
  }

  const producedSpeech = result.text.trim().length > 0;

  const updated = await prisma.deskSource.update({
    where: { id: existing.id },
    data: {
      status: producedSpeech ? "transcribed" : "pending",
      provider: result.provider,
      language: result.language,
      durationMs: result.durationMs,
      transcript: producedSpeech ? renderTranscript(result) : "",
      segmentsJson: JSON.stringify(result.segments),
      error: producedSpeech
        ? null
        : "No transcription provider is configured, so no speech was processed. " +
          "The source is left pending rather than recorded as an empty transcript.",
    },
  });

  if (producedSpeech) {
    await appendActivity({
      action: "desk.source.ingested",
      entityType: "desk_source",
      entityId: updated.id,
      summary: `Ingested ${updated.kind} "${updated.title}" (${result.segments.length} segments)`,
      actorEmail: input.actorEmail,
      payload: { provider: result.provider, durationMs: result.durationMs },
    });
    await recordUsageEvent({
      userId: input.actorEmail,
      kind: "ai_credit",
      // Transcribing an hour of video is not the same cost as a stage run, but
      // it is charged in the same unit the user reasons about. Recording it at
      // all is the point: an ingest that costs us money and is not counted is
      // how a tier's economics drift wrong unnoticed.
      units: 1,
      meta: {
        desk: "source.ingest",
        sourceId: updated.id,
        kind: updated.kind,
        provider: result.provider,
        durationMs: result.durationMs,
      },
    });
  }

  return toDeskSourceDTO(updated);
}

function providerName(provider: TranscriptionProvider): string {
  return provider.constructor?.name ?? "unknown";
}

export function getTranscriptionProvider(): TranscriptionProvider {
  return new PlaceholderTranscriptionProvider();
}

/**
 * Read a source's transcript as briefing material, or refuse.
 *
 * Returns `null` for anything not `transcribed`. The desk asks this before
 * briefing, so an un-ingested source cannot quietly brief a job with an empty
 * string — the failure has to happen here, where the reason is known, rather
 * than in the draft, where it looks like the model had nothing to say.
 */
export async function sourceBriefMaterial(
  sourceId: string,
): Promise<{ title: string; kind: SourceKind; transcript: string } | null> {
  const row = await prisma.deskSource.findUnique({ where: { id: sourceId } });
  if (!row || row.status !== "transcribed") return null;
  if (!row.transcript.trim()) return null;
  return {
    title: row.title,
    kind: isSourceKind(row.kind) ? row.kind : "doc",
    transcript: row.transcript,
  };
}

/**
 * Sources linked to a job, scoped by owner.
 *
 * Same rule as every other desk read: the owner is the first argument and an
 * absent owner returns nothing. A source is the most private thing in MatOS —
 * it is the owner's own voice — so the failure mode of a missing scope has to
 * be a blank screen.
 */
export async function listDeskSources(
  owner: DeskOwner | null,
  opts?: { jobId?: string },
): Promise<DeskSourceDTO[]> {
  if (!owner) return [];
  const rows = await prisma.deskSource.findMany({
    where: {
      createdBy: owner,
      ...(opts?.jobId ? { jobId: opts.jobId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDeskSourceDTO);
}

export type { SourceRow };
export { sourceInclude };
