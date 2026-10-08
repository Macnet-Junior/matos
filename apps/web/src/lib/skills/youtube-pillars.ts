/**
 * The Pillars skill — does this video belong to a body of work, or is it a
 * one-off?
 *
 * Hook grades a video's opening. Loop grades whether the video paid off what it
 * promised. Pillars grades something the video cannot answer on its own: whether
 * it is the *same* video the channel has made before. A channel without pillars
 * publishes a series of unrelated good videos and wonders why none of them
 * compound — each one starts the audience relationship from zero.
 *
 * This is why the check takes the channel's history as an input rather than
 * reading the transcript alone. The failure it names is not visible inside any
 * single transcript: every video can be specific, well-looped, and still leave
 * the channel with nothing. What the check can measure from a transcript is the
 * *shape* of a pillar — the topic the video claims, and whether it repeats the
 * channel's existing ones — so that is all it claims to measure.
 *
 * Honest boundary, as with the other two: this reads text. A pillar that lives
 * in a visual format — a recurring set, a costume, a thumbnail system — is
 * invisible here, and every result says so rather than implying it saw the
 * channel.
 */
import type { TranscriptSegment } from "@/lib/desk/sources";

export type PillarDefinition = {
  /** Stable key for the pillar, used to match a video's topic against it. */
  id: string;
  /** Human label, for findings. */
  label: string;
  /**
   * Phrases that mark this pillar. Matched case-insensitively as substrings of
   * the video's topic. Kept as the channel owner writes them rather than
   * stemmed or inferred, because a pillar the module guessed at is a pillar the
   * owner cannot act on.
   */
  markers: string[];
};

export type PillarsOptions = {
  /** The channel's declared pillars. Empty means the channel has not defined any. */
  pillars?: PillarDefinition[];
  /**
   * Topic ids this channel has already published on. Used to tell a pillar the
   * channel owns from a new one it is starting. Absent means the history is
   * unknown, and the finding says so rather than assuming a fresh channel.
   */
  publishedTopics?: string[];
  /** How many pillars a channel needs before the spread is worth measuring. */
  minPillars?: number;
};

export type PillarFinding = {
  code: string;
  ok: boolean;
  detail: string;
  atMs: number | null;
  evidence: string | null;
};

export type PillarsCheckResult = {
  skill: "pillars";
  ok: boolean;
  findings: PillarFinding[];
  /** Pillars the video's topic matched. */
  matched: PillarDefinition[];
  /** True when the video's topic matches no declared pillar. */
  orphan: boolean;
  transcriptOnly: true;
};

/**
 * How many statements of topic a transcript has to make before the module will
 * call one of them "the topic".
 *
 * Below this the check has nothing to match and says so. Guessing the topic of
 * a video from one incidental sentence would produce a confident pillars
 * verdict about a video whose subject the module never learned.
 */
export const MIN_TOPIC_STATEMENTS = 2;

/**
 * Sentences where a creator states what the video is about.
 *
 * The same shape the Hook check refuses to accept as a hook — "in this video I
 * explain" — is exactly what the Pillars check needs. A hook should not announce
 * its topic; a record of what the video is for should. The two modules read the
 * same sentence and use it for opposite purposes, which is why neither can share
 * one marker list.
 */
const TOPIC_MARKERS: RegExp[] = [
  /\b(in this video|today'?s video|this video is about)\b[^.!?]*/i,
  /\b(i'?m going to (talk about|explain|show|cover)|we'?re (talking about|covering))\b[^.!?]*/i,
  /\bthe (topic|subject) (today|here) is\b[^.!?]*/i,
  /\bthis is (part|episode|installment)\s+\w+ of\b[^.!?]*/i,
];

/**
 * Find the sentences in which the video states its own topic.
 *
 * Returns the matched clauses in transcript order, trimmed to the clause rather
 * than the whole segment — a segment can run for ten seconds and contain three
 * sentences, only one of which is the topic statement.
 */
export function topicStatements(segments: TranscriptSegment[]): string[] {
  const out: string[] = [];
  for (const s of segments) {
    for (const re of TOPIC_MARKERS) {
      const m = s.text.match(re);
      if (m && m[0].trim().length > 0) out.push(m[0].trim());
    }
  }
  return out;
}

/**
 * Which declared pillars does a piece of text match?
 *
 * A pillar matches when any of its markers appears in the topic text as a
 * case-insensitive substring. Substring rather than word-boundary on purpose:
 * a channel that names a pillar "email list" should match "email lists", and a
 * boundary match would silently fail on the plural — the channel's own video
 * would come back an orphan for a reason the owner cannot see in the label.
 */
export function matchPillars(
  topic: string,
  pillars: PillarDefinition[],
): PillarDefinition[] {
  const haystack = topic.toLowerCase();
  return pillars.filter((p) =>
    p.markers.some((m) => m.trim() && haystack.includes(m.toLowerCase())),
  );
}

/**
 * Check whether a video sits on one of the channel's pillars.
 *
 * The findings run from least to most specific, and the least specific is
 * always first: a channel with no declared pillars cannot produce a meaningful
 * orphan verdict, so the check says *that* rather than reporting every video as
 * off-pillar. Naming the real problem is the difference between an actionable
 * finding and a stream of false ones.
 */
export function checkPillars(
  segments: TranscriptSegment[],
  options: PillarsOptions = {},
): PillarsCheckResult {
  const pillars = options.pillars ?? [];
  const minPillars = options.minPillars ?? 2;
  const findings: PillarFinding[] = [];
  const topics = topicStatements(segments);
  const topic = topics.join(" ");

  // Finding 0 — the channel has not defined its pillars.
  //
  // This is the finding that matters most when it fires, because every other
  // finding below would be noise. A channel with no pillars makes every video
  // an orphan by definition; reporting that per-video would blame the videos
  // for a decision the channel never made.
  if (pillars.length === 0) {
    findings.push({
      code: "no_pillars_defined",
      ok: false,
      detail:
        "This channel has no declared pillars, so there is no body of work for a video to belong to. Every video is a one-off until the pillars exist — this is a channel-level gap, not a fault in this transcript.",
      atMs: null,
      evidence: null,
    });
    return {
      skill: "pillars",
      ok: false,
      findings,
      matched: [],
      orphan: true,
      transcriptOnly: true,
    };
  }

  // Finding 1 — the transcript never states its topic, so nothing can be
  // matched against the pillars. Distinct from "states a topic that matches
  // nothing": the fix is different (say what the video is for, versus move it
  // onto a pillar).
  if (topics.length < MIN_TOPIC_STATEMENTS) {
    findings.push({
      code: "topic_not_stated",
      ok: false,
      detail: `The transcript states its topic ${topics.length === 0 ? "nowhere" : "only once"}, so there is nothing to match against the channel's ${pillars.length} pillar${pillars.length === 1 ? "" : "s"}. Whether the video belongs to one cannot be determined from text alone.`,
      atMs: null,
      evidence: topics[0] ?? null,
    });
    return {
      skill: "pillars",
      ok: false,
      findings,
      matched: [],
      orphan: false,
      transcriptOnly: true,
    };
  }

  const matched = matchPillars(topic, pillars);
  const orphan = matched.length === 0;

  // Finding 2 — off-pillar. The video is about something, and it is not any of
  // the things the channel is about.
  findings.push({
    code: orphan ? "orphan_video" : "on_pillar",
    ok: !orphan,
    detail: orphan
      ? `The video's stated topic matches none of the channel's ${pillars.length} pillars (${pillars.map((p) => p.label).join(", ")}). It may be a good video; it is not a repeatable one — nothing in it compounds a body of work.`
      : `The video's stated topic matches the ${matched.map((p) => `"${p.label}"`).join(" and ")} pillar${matched.length === 1 ? "" : "s"}.`,
    atMs: null,
    evidence: topic,
  });

  if (orphan) {
    return {
      skill: "pillars",
      ok: false,
      findings,
      matched,
      orphan,
      transcriptOnly: true,
    };
  }

  // Finding 3 — a topic that matches *several* pillars is doing too much. A
  // video that is about three of the channel's subjects is about none of them
  // sharply enough to build on, and the audience that arrives for one pillar
  // gets two others.
  if (matched.length > 1) {
    findings.push({
      code: "straddles_pillars",
      ok: false,
      detail: `The video sits on ${matched.length} pillars at once (${matched.map((p) => `"${p.label}"`).join(", ")}), so a viewer who arrives for one of them is handed the others. A pillar video should be unmistakably one thing.`,
      atMs: null,
      evidence: topic,
    });
  }

  // Finding 4 — is this actually new ground, or a repeat? Both are fine, but
  // the check has to say which it found rather than calling every on-pillar
  // video a continuation.
  if (options.publishedTopics) {
    const already = matched.filter((p) => options.publishedTopics!.includes(p.id));
    const fresh = matched.filter((p) => !options.publishedTopics!.includes(p.id));
    if (fresh.length === 0) {
      findings.push({
        code: "pillar_continuation",
        ok: true,
        detail: `Every pillar this video matches is already established on the channel — this video extends work the audience has seen rather than starting a new line.`,
        atMs: null,
        evidence: null,
      });
    } else if (already.length === 0) {
      findings.push({
        code: "pillar_started",
        ok: true,
        detail: `This video introduces ${fresh.map((p) => `"${p.label}"`).join(" and ")} — a pillar the channel has not published on before. Worth watching whether a second video follows it, because one video is not yet a pillar.`,
        atMs: null,
        evidence: null,
      });
    } else {
      findings.push({
        code: "pillar_mixed",
        ok: true,
        detail: `This video extends ${already.map((p) => `"${p.label}"`).join(", ")} and introduces ${fresh.map((p) => `"${p.label}"`).join(", ")} in the same piece.`,
        atMs: null,
        evidence: null,
      });
    }
  }

  // Finding 5 — has the channel spread across enough pillars for the body of
  // work to hold up? A channel on one pillar is a channel, not a library.
  if (options.publishedTopics) {
    const covered = pillars.filter((p) => options.publishedTopics!.includes(p.id));
    if (covered.length < minPillars) {
      findings.push({
        code: "narrow_pillar_spread",
        ok: false,
        detail: `The channel has published on ${covered.length} of its ${pillars.length} pillars. Below ${minPillars} the body of work is a single topic under several names, and a viewer who does not want that topic has nothing else to stay for.`,
        atMs: null,
        evidence: null,
      });
    } else {
      findings.push({
        code: "pillar_spread_ok",
        ok: true,
        detail: `The channel has published on ${covered.length} of its ${pillars.length} pillars — enough spread for a viewer to find a second thing to watch.`,
        atMs: null,
        evidence: null,
      });
    }
  }

  return {
    skill: "pillars",
    ok: findings.every((f) => f.ok),
    findings,
    matched,
    orphan,
    transcriptOnly: true,
  };
}
