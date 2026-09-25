import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import { assertIsolatedTestDatabase } from "@/test/db-fixtures";
import { deskOwner } from "./index";
import {
  createDeskSource,
  getTranscriptionProvider,
  ingestSource,
  listDeskSources,
  renderTranscript,
  sourceBriefMaterial,
  type TranscriptResult,
  type TranscriptionProvider,
} from "./sources";

/**
 * The tests below are mostly about refusal, and that is deliberate.
 *
 * The dangerous outcome in this module is not a failed transcription — that is
 * visible. It is a *successful looking* one built on nothing: an empty string
 * marked `transcribed`, handed to the desk as the owner's own words, and
 * drafted into a post with a confident tone and no source behind it. So the
 * assertions are on the absence — the row that stays `pending`, the brief
 * material that comes back null — rather than on the happy path that would
 * pass whichever way the guard was written.
 */

const OWNER = "source-owner@matos.test";
const OTHER = "source-other@matos.test";

/** A provider that returns real speech, so the happy path is exercised too. */
class FakeProvider implements TranscriptionProvider {
  constructor(private readonly result: Partial<TranscriptResult> = {}) {}

  async transcribe(): Promise<TranscriptResult> {
    return {
      text: "We raised the price because support costs doubled.",
      segments: [
        { startMs: 0, endMs: 4_000, text: "We raised the price" },
        { startMs: 4_000, endMs: 9_500, text: "because support costs doubled." },
      ],
      language: "en",
      durationMs: 9_500,
      provider: "fake",
      ...this.result,
    };
  }
}

beforeAll(async () => {
  assertIsolatedTestDatabase();
  await prisma.deskSource.deleteMany();
});

afterAll(async () => {
  await prisma.deskSource.deleteMany();
});

describe("desk sources (db)", () => {
  it("keeps the transcript raw, with timestamps intact", async () => {
    const source = await createDeskSource({
      kind: "call",
      title: "Pricing call",
      origin: "https://example.test/recording",
      actorEmail: OWNER,
    });
    expect(source.status).toBe("pending");
    expect(source.transcript).toBe("");

    const ingested = await ingestSource({
      sourceId: source.id,
      filePath: "/tmp/does-not-matter.mp3",
      actorEmail: OWNER,
      provider: new FakeProvider(),
    });

    expect(ingested.status).toBe("transcribed");
    expect(ingested.provider).toBe("fake");
    expect(ingested.segmentCount).toBe(2);
    expect(ingested.durationMs).toBe(9_500);

    // Timestamps survive, because a claim traced to [00:04] is checkable and a
    // wall of prose is not. This is the whole reason the source is kept.
    expect(ingested.transcript).toContain("[00:00] We raised the price");
    expect(ingested.transcript).toContain("[00:04] because support costs doubled.");
    expect(ingested.transcript).toContain("Language: en");
  });

  it("refuses to call an empty transcript a success", async () => {
    const source = await createDeskSource({
      kind: "video",
      title: "No provider configured",
      origin: "workspace/media/talk.mp4",
      actorEmail: OWNER,
    });

    // The default provider with no API key. It returns no speech, and the
    // honest result is a source still pending with a reason — never a row
    // marked transcribed carrying an empty string.
    const ingested = await ingestSource({
      sourceId: source.id,
      filePath: "/tmp/talk.mp4",
      actorEmail: OWNER,
    });

    expect(ingested.status).toBe("pending");
    expect(ingested.transcript).toBe("");
    expect(ingested.provider).toBe("placeholder");
    expect(ingested.error).toMatch(/no transcription provider is configured/i);

    // The provider itself must not fabricate speech. A plausible-sounding
    // placeholder is worse than none: it is indistinguishable downstream from
    // a real transcript, and would be published back as the owner's words.
    const result = await getTranscriptionProvider().transcribe({
      filePath: "/tmp/talk.mp4",
      kind: "video",
      title: "No provider configured",
    });
    expect(result.text).toBe("");
    expect(result.provider).toBe("placeholder");
  });

  it("records a failure as failed, and lets it be retried", async () => {
    const source = await createDeskSource({
      kind: "audio",
      title: "Broken upload",
      origin: "workspace/media/broken.m4a",
      actorEmail: OWNER,
    });

    class ExplodingProvider implements TranscriptionProvider {
      async transcribe(): Promise<TranscriptResult> {
        throw new Error("upstream 502");
      }
    }

    const failed = await ingestSource({
      sourceId: source.id,
      filePath: "/tmp/broken.m4a",
      actorEmail: OWNER,
      provider: new ExplodingProvider(),
    });
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("upstream 502");

    // failed is recoverable — the second attempt with a working provider
    // replaces the error rather than being stuck behind it.
    const retried = await ingestSource({
      sourceId: source.id,
      filePath: "/tmp/broken.m4a",
      actorEmail: OWNER,
      provider: new FakeProvider(),
    });
    expect(retried.status).toBe("transcribed");
    expect(retried.error).toBeNull();
  });

  it("refuses to hand the desk material from a source that is not transcribed", async () => {
    const pending = await createDeskSource({
      kind: "doc",
      title: "Not yet processed",
      origin: "workspace/docs/brief.md",
      actorEmail: OWNER,
    });

    // This is the guard the desk depends on. Null here means a job cannot be
    // briefed with an empty string and then blamed on the model having nothing
    // to say — the refusal happens where the reason is still known.
    expect(await sourceBriefMaterial(pending.id)).toBeNull();

    await ingestSource({
      sourceId: pending.id,
      filePath: "/tmp/brief.md",
      actorEmail: OWNER,
      provider: new FakeProvider(),
    });
    const material = await sourceBriefMaterial(pending.id);
    expect(material?.transcript).toContain("support costs doubled");
  });

  it("counts a real ingest in the usage ledger and a no-op ingest not at all", async () => {
    const counted = await createDeskSource({
      kind: "call",
      title: "Counted call",
      origin: "rec-a",
      actorEmail: OWNER,
    });
    const uncounted = await createDeskSource({
      kind: "call",
      title: "Uncounted call",
      origin: "rec-b",
      actorEmail: OWNER,
    });

    await ingestSource({
      sourceId: counted.id,
      filePath: "/tmp/a.mp3",
      actorEmail: OWNER,
      provider: new FakeProvider(),
    });
    // No provider → nothing was transcribed → the user was provided nothing,
    // so nothing is charged. Billing for a run that produced no material is
    // how a ledger stops describing what actually happened.
    await ingestSource({
      sourceId: uncounted.id,
      filePath: "/tmp/b.mp3",
      actorEmail: OWNER,
    });

    const events = await prisma.usageEvent.findMany({
      where: { userId: OWNER, kind: "ai_credit" },
    });
    // Scoped to this test's two sources: earlier tests in this file ingest
    // with real providers too, and counting those would make the assertion
    // pass or fail on test ordering rather than on the rule being tested.
    const forSource = (id: string) =>
      events.filter(
        (e) =>
          (JSON.parse(e.metaJson) as { desk?: string; sourceId?: string })
            .sourceId === id,
      );
    expect(forSource(counted.id)).toHaveLength(1);
    expect(forSource(uncounted.id)).toHaveLength(0);
  });

  it("keeps one owner's sources out of another's desk", async () => {
    await createDeskSource({
      kind: "video",
      title: "Owner's private talk",
      origin: "private",
      actorEmail: OWNER,
    });

    // A source is the owner's own voice — the most private thing in MatOS. The
    // failure mode of a missing scope has to be a blank screen, not a leak.
    const theirs = await listDeskSources(deskOwner(OTHER));
    expect(theirs).toEqual([]);

    const mine = await listDeskSources(deskOwner(OWNER));
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((s) => s.createdBy === OWNER)).toBe(true);

    // And an absent owner reads nothing, rather than everything.
    expect(await listDeskSources(null)).toEqual([]);
  });

  it("renders a bare text transcript without inventing timestamps", () => {
    const rendered = renderTranscript({
      text: "A short article body.",
      segments: [],
      language: null,
      durationMs: null,
      provider: "fake",
    });
    expect(rendered).toBe("A short article body.");
    expect(rendered).not.toContain("[00:00]");
  });
});
