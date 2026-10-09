import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import { assertIsolatedTestDatabase } from "@/test/db-fixtures";
import { createDeskJob, runDeskStage } from "./index";
import { sourceSegments } from "./sources";
import { retryYoutubeSkill, startYoutubeSkill } from "./youtube-source";

/**
 * Gemini is mocked. These tests are about the promise the desk makes: a parsed
 * skill is a draft the grade can read, and a failed call or a bad parse never
 * becomes a transcribed source or a skill row.
 */

const OWNER = "youtube-skill@matos.test";
const KEY = "test-gemini-key-not-real";

const GOOD_SKILL = {
  name: "faceless-workflow",
  description:
    "Turn the faceless YouTube workflow from this video into steps an agent can follow. Use when the user asks to apply that workflow.",
  body: `# Faceless workflow

## What is on screen

A screen recording of the editor, with the timeline open and the first fifteen seconds highlighted.

## Steps

1. Cut the opening to the claim.
2. Show the workflow on the timeline before explaining it.
3. End on the same claim the opening made.
`,
  language: "en",
  durationMs: 120_000,
  segments: [
    { startMs: 0, endMs: 3_000, text: "Hey guys, welcome back to the channel." },
    { startMs: 4_000, endMs: 9_000, text: "Don't forget to subscribe." },
    { startMs: 40_000, endMs: 46_000, text: "In this video I explain the workflow step by step." },
    { startMs: 70_000, endMs: 74_000, text: "Here's why the workflow matters." },
  ],
};

const PASTE = [
  "[00:00] Hey guys, welcome back to the channel.",
  "[00:04] Don't forget to subscribe.",
  "[00:40] In this video I explain the workflow step by step.",
  "[01:10] Here's why the workflow matters.",
].join("\n");

function envelope(skill: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(skill) }] } }],
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

function fetchOk(): typeof fetch {
  return (async () => envelope(GOOD_SKILL)) as typeof fetch;
}

beforeAll(async () => {
  assertIsolatedTestDatabase();
  await prisma.deskSource.deleteMany({ where: { createdBy: OWNER } });
  await prisma.deskJob.deleteMany({ where: { createdBy: OWNER } });
});

afterAll(async () => {
  await prisma.deskSource.deleteMany({ where: { createdBy: OWNER } });
  await prisma.deskJob.deleteMany({ where: { createdBy: OWNER } });
});

async function job() {
  return createDeskJob({
    topic: "YouTube skill draft",
    audience: "Authors",
    offerCta: "Watch the video",
    channels: ["blog"],
    actorEmail: OWNER,
  });
}

describe("youtube skill drafts (db)", () => {
  it("keeps the Gemini client inside Skillwright", () => {
    const src = fs.readFileSync(path.resolve("src/lib/desk/youtube-source.ts"), "utf8");
    expect(src).toContain("skillwright/youtube-skill");
    expect(src).not.toContain("generativelanguage.googleapis.com");
    expect(src).not.toContain("GEMINI_API_KEY");
  });

  it("drafts a skill from a YouTube URL, grades it, and does not watch it", async () => {
    const skillsBefore = await prisma.skill.count();
    const created = await job();
    let sawProcessing = false;

    const done = await startYoutubeSkill({
      jobId: created.id,
      actorEmail: OWNER,
      title: "Episode 12",
      youtubeUrl: "https://youtu.be/dQw4w9WgXcQ",
      deps: {
        env: { GEMINI_API_KEY: KEY },
        fetchImpl: (async () => {
          const row = await prisma.deskSource.findFirst({
            where: { jobId: created.id, title: "Episode 12" },
          });
          sawProcessing = row?.status === "processing";
          return envelope(GOOD_SKILL);
        }) as typeof fetch,
      },
    });

    expect(sawProcessing).toBe(true);
    expect(done.source.status).toBe("transcribed");
    expect(done.source.provider).toBe("gemini");
    expect(done.source.skillReadiness).toBe("draft");
    expect(done.source.skillName).toBe("faceless-workflow");
    expect(done.source.skillDraft).toMatch(/not a watched skill/i);
    expect(done.source.skillDraft).not.toContain(KEY);
    expect(done.grade?.firstProblem).toBe("hook");
    expect(done.grade?.findings.some((finding) => finding.code === "hook_window_is_housekeeping")).toBe(
      true,
    );

    const row = await prisma.deskSource.findUnique({ where: { id: done.source.id } });
    expect(row?.skillReadiness).toBe("draft");
    expect(row?.skillReadiness).not.toBe("watched");
    expect(row?.skillReadiness).not.toBe("approved");
    expect(await prisma.skill.findFirst({ where: { slug: "faceless-workflow" } })).toBeNull();
    expect(await prisma.skill.count()).toBe(skillsBefore);

    const scouted = await runDeskStage({ jobId: created.id, actorEmail: OWNER });
    const body = scouted.artifacts[0]?.body ?? "";
    expect(body).toContain("Transcript grade");
    expect(body).toContain("[hook] hook_window_is_housekeeping @ 00:00");
    expect(body).toContain("Fix first: **hook**");
  });

  it("leaves a failed Gemini call retryable and unread", async () => {
    const skillsBefore = await prisma.skill.count();
    const created = await job();
    const failed = await startYoutubeSkill({
      jobId: created.id,
      actorEmail: OWNER,
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      deps: {
        env: { GEMINI_API_KEY: KEY },
        fetchImpl: (async () => new Response(`leak ${KEY}`, { status: 500 })) as typeof fetch,
      },
    });

    expect(failed.source.status).toBe("failed");
    expect(failed.source.skillReadiness).toBe("unfinished");
    expect(failed.source.skillDraft).toBe("");
    expect(failed.source.transcript).toBe("");
    expect(failed.grade).toBeNull();
    expect(failed.source.error).toMatch(/nothing was saved/i);
    expect(failed.source.error).not.toContain(KEY);
    expect(await sourceSegments(failed.source.id)).toBeNull();
    expect(await prisma.skill.count()).toBe(skillsBefore);

    const retried = await retryYoutubeSkill({
      sourceId: failed.source.id,
      actorEmail: OWNER,
      deps: { env: { GEMINI_API_KEY: KEY }, fetchImpl: fetchOk() },
    });
    expect(retried.source.status).toBe("transcribed");
    expect(retried.source.skillReadiness).toBe("draft");
    expect(retried.grade?.firstProblem).toBe("hook");
    expect(await prisma.skill.count()).toBe(skillsBefore);
  });

  it("does not turn a bad parse into a watched or transcribed skill", async () => {
    const created = await job();
    const bad = await startYoutubeSkill({
      jobId: created.id,
      actorEmail: OWNER,
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      deps: {
        env: { GEMINI_API_KEY: KEY },
        fetchImpl: (async () =>
          new Response(
            JSON.stringify({
              candidates: [{ content: { parts: [{ text: "not json and not a skill" }] } }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          )) as typeof fetch,
      },
    });

    expect(bad.source.status).toBe("failed");
    expect(bad.source.status).not.toBe("transcribed");
    expect(bad.source.skillReadiness).toBe("unfinished");
    expect(bad.source.skillDraft).toBe("");
    expect(bad.source.transcript).toBe("");
    expect(bad.grade).toBeNull();
    expect(bad.source.error).toMatch(/not a skill/i);
    const row = await prisma.deskSource.findUnique({ where: { id: bad.source.id } });
    expect(row?.skillReadiness).toBe("unfinished");
    expect(row?.transcript).toBe("");
    expect(await sourceSegments(bad.source.id)).toBeNull();
    expect(await prisma.skill.findFirst({ where: { slug: "faceless-workflow" } })).toBeNull();
  });

  it("reports a missing key in plain words and does not call Gemini", async () => {
    const created = await job();
    let called = false;
    const missing = await startYoutubeSkill({
      jobId: created.id,
      actorEmail: OWNER,
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      deps: {
        env: {},
        fetchImpl: (async () => {
          called = true;
          return envelope(GOOD_SKILL);
        }) as typeof fetch,
      },
    });
    expect(called).toBe(false);
    expect(missing.source.status).toBe("failed");
    expect(missing.source.skillReadiness).toBe("unfinished");
    expect(missing.source.skillDraft).toBe("");
    expect(missing.source.error).toMatch(/GEMINI_API_KEY/);
    expect(missing.source.error).toMatch(/\.env\.local/);
    expect(missing.grade).toBeNull();
  });

  it("grades a pasted transcript through the same draft path", async () => {
    const created = await job();
    let sawFile = false;
    const done = await startYoutubeSkill({
      jobId: created.id,
      actorEmail: OWNER,
      title: "Pasted episode",
      transcript: PASTE,
      deps: {
        env: { GEMINI_API_KEY: KEY },
        fetchImpl: (async (_url: string, init?: RequestInit) => {
          const body = String(init?.body ?? "");
          sawFile = body.includes("file_data");
          return envelope({
            ...GOOD_SKILL,
            segments: [{ startMs: 0, endMs: 1, text: "invented line the model made up" }],
          });
        }) as typeof fetch,
      },
    });

    expect(sawFile).toBe(false);
    expect(done.source.status).toBe("transcribed");
    expect(done.source.provider).toBe("manual");
    expect(done.source.skillReadiness).toBe("draft");
    expect(done.source.transcript).toContain("[00:00] Hey guys, welcome back to the channel.");
    expect(done.source.transcript).not.toContain("invented line");
    expect(done.grade?.firstProblem).toBe("hook");
    const material = await sourceSegments(done.source.id);
    expect(material?.segments[0]?.text).toBe("Hey guys, welcome back to the channel.");
    expect(await prisma.skill.findFirst({ where: { slug: "faceless-workflow" } })).toBeNull();
  });

  it("refuses a non-YouTube link before creating a source", async () => {
    const created = await job();
    await expect(
      startYoutubeSkill({
        jobId: created.id,
        actorEmail: OWNER,
        youtubeUrl: "https://example.com/watch?v=dQw4w9WgXcQ",
        deps: { env: { GEMINI_API_KEY: KEY }, fetchImpl: fetchOk() },
      }),
    ).rejects.toThrow(/not a YouTube/);
    expect(await prisma.deskSource.count({ where: { jobId: created.id } })).toBe(0);
  });
});
