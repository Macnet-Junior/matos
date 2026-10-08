import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import { assertIsolatedTestDatabase, cleanupDeskFixtures } from "@/test/db-fixtures";
import { createDeskSource, ingestSource, type TranscriptResult, type TranscriptionProvider } from "./sources";
import {
  actOnInboxItem,
  createDeskJob,
  deskOwner,
  listCalendarItems,
  listDeskJobs,
  reviewDeskStage,
  runDeskStage,
  updateDeskArtifact,
} from "./index";

/** A transcript whose opening is housekeeping, so the hook check fails it. */
class HousekeepingProvider implements TranscriptionProvider {
  async transcribe(): Promise<TranscriptResult> {
    return {
      text: "Hey guys, welcome back. In this video I explain the topic.",
      segments: [
        { startMs: 0, endMs: 3_000, text: "Hey guys, welcome back to the channel." },
        { startMs: 4_000, endMs: 9_000, text: "Don't forget to subscribe." },
        { startMs: 40_000, endMs: 46_000, text: "In this video I explain the workflow step by step." },
        { startMs: 70_000, endMs: 74_000, text: "Here's why the workflow matters." },
      ],
      language: "en",
      durationMs: 120_000,
      provider: "fake",
    };
  }
}

describe("desk pipeline (db)", () => {
  beforeAll(async () => {
    assertIsolatedTestDatabase();
    await cleanupDeskFixtures();
  });

  afterAll(async () => {
    await cleanupDeskFixtures();
  });

  it("seeds sample desk jobs", async () => {
    // The list is scoped now, so a seed assertion has to name whose desk it
    // reads. The two seeded jobs have different authors on purpose (see
    // packages/db/prisma/seed.ts) — reading one owner's desk proves the scope
    // narrows, and reading both proves the seed is still complete.
    const mine = await listDeskJobs(deskOwner("macnet@matos.local"));
    const theirs = await listDeskJobs(deskOwner("author@matos.local"));
    const jobs = [...mine, ...theirs];

    expect(mine).toHaveLength(1);
    expect(jobs.length).toBeGreaterThanOrEqual(2);
    const titles = jobs.map((j) => j.title);
    expect(titles.some((t) => t.includes("ICP") || t.includes("Warm"))).toBe(
      true,
    );
  });

  it("puts a graded transcript into the scout brief, and nothing when there is none", async () => {
    const owner = "grader@matos.local";

    // First: a job whose source never produced speech. The scout brief must
    // come back without a grade block at all — an empty "Nothing graded" header
    // would read downstream as a video that had been checked and passed.
    const ungraded = await createDeskJob({
      topic: "No transcript yet",
      audience: "Authors",
      offerCta: "Ingest a source",
      channels: ["blog"],
      actorEmail: owner,
    });
    const bare = await runDeskStage({ jobId: ungraded.id, actorEmail: owner });
    expect(bare.artifacts[0]!.body).not.toContain("Transcript grade");

    // Then: the same job, with a real transcript attached. The opening is
    // housekeeping, so the hook must fail and the failure has to survive all
    // the way into the artifact the owner reads — not just live in the module.
    const source = await createDeskSource({
      kind: "video",
      title: "Episode 12",
      origin: "workspace/media/ep12.mp4",
      jobId: ungraded.id,
      actorEmail: owner,
    });
    await ingestSource({
      sourceId: source.id,
      filePath: "/tmp/ep12.mp4",
      actorEmail: owner,
      provider: new HousekeepingProvider(),
    });

    const graded = await prisma.deskJob.update({
      where: { id: ungraded.id },
      data: {
        stage: "scout",
        status: "draft",
      },
    });
    expect(graded.id).toBe(ungraded.id);

    // Stage back to scout so the same job re-runs with the source now attached.
    await prisma.deskStageArtifact.deleteMany({ where: { jobId: ungraded.id } });
    const scouted = await runDeskStage({ jobId: ungraded.id, actorEmail: owner });
    const body = scouted.artifacts[0]!.body;
    expect(body).toContain("Transcript grade");
    // The failing sentence itself, with its timestamp — the thing a draft stage
    // must not be able to paraphrase away into generic advice.
    expect(body).toContain("[hook] hook_window_is_housekeeping @ 00:00");
    expect(body).toContain("Fix first: **hook**");
    expect(body).toContain("not instructions for the draft below");
  });

  it("creates a brief and cannot skip the Scout gate", async () => {
    const job = await createDeskJob({
      topic: "Gate skip test",
      audience: "Authors",
      offerCta: "Stay on Desk",
      channels: ["blog"],
      actorEmail: "author@matos.local",
    });
    expect(job.stage).toBe("scout");
    expect(job.status).toBe("draft");

    // Cannot approve without an artifact
    await expect(
      reviewDeskStage({
        jobId: job.id,
        action: "approve",
        actorEmail: "operator@matos.local",
      }),
    ).rejects.toThrow(/ready artifact/i);

    const scouted = await runDeskStage({
      jobId: job.id,
      actorEmail: "author@matos.local",
    });
    expect(scouted.status).toBe("awaiting_approval");
    expect(scouted.artifacts[0]?.stage).toBe("scout");
    expect(scouted.artifacts[0]?.reviewState).toBe("ready");

    // Force stage ahead illegally should fail on run of ghost before approve
    await prisma.deskJob.update({
      where: { id: job.id },
      data: { stage: "ghost" },
    });
    await expect(
      runDeskStage({
        jobId: job.id,
        actorEmail: "author@matos.local",
      }),
    ).rejects.toThrow(/until Scout is approved/i);

    // Restore and approve properly
    await prisma.deskJob.update({
      where: { id: job.id },
      data: { stage: "scout", status: "awaiting_approval" },
    });
    const afterScout = await reviewDeskStage({
      jobId: job.id,
      action: "approve",
      actorEmail: "operator@matos.local",
    });
    expect(afterScout.stage).toBe("ghost");
    expect(afterScout.status).toBe("draft");
  });

  it("schedules calendar items on Clock approve and keeps inbox unsent", async () => {
    const job = await createDeskJob({
      title: "Clock + Echo path",
      topic: "Schedule without publish",
      audience: "Operators",
      offerCta: "Check Calendar",
      channels: ["linkedin", "x"],
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      actorEmail: "macnet@matos.local",
    });

    // Fast-forward: generate + approve each stage through echo
    for (let i = 0; i < 6; i++) {
      await runDeskStage({
        jobId: job.id,
        actorEmail: "macnet@matos.local",
      });
      const advanced = await reviewDeskStage({
        jobId: job.id,
        action: "approve",
        actorEmail: "macnet@matos.local",
      });
      if (advanced.stage === "filed") break;
    }

    const filed = await prisma.deskJob.findUniqueOrThrow({
      where: { id: job.id },
      include: { calendarItems: true, inboxItems: true },
    });
    expect(filed.stage).toBe("filed");
    expect(filed.calendarItems.length).toBe(2);
    const xPack = filed.calendarItems.find((item) => item.channel === "x");
    const linkedinPack = filed.calendarItems.find((item) => item.channel === "linkedin");
    expect(xPack?.body).toMatch(/gated desk/i);
    expect(linkedinPack?.body).toMatch(/Operators drown/i);
    expect(xPack?.body).not.toMatch(/Scheduled pack/i);
    expect(filed.inboxItems.length).toBeGreaterThanOrEqual(1);
    expect(filed.inboxItems.every((i) => i.status === "drafted")).toBe(true);

    // The job on this path was created as macnet@matos.local, and a calendar
    // row is only reachable through the job that owns it — asking as any other
    // owner returns nothing, which is the isolation rule working.
    const cal = await listCalendarItems(deskOwner("macnet@matos.local"));
    expect(cal.some((c) => c.jobId === job.id)).toBe(true);

    const inboxId = filed.inboxItems[0]!.id;
    const approved = await actOnInboxItem({
      id: inboxId,
      action: "approve",
      actorEmail: "operator@matos.local",
    });
    expect(approved.status).toBe("approved");
    // Still not sent — no sent status exists
    expect(["drafted", "approved", "copied"]).toContain(approved.status);

    const copied = await actOnInboxItem({
      id: inboxId,
      action: "copied",
      actorEmail: "operator@matos.local",
    });
    expect(copied.status).toBe("copied");
    expect(copied.copiedAt).toBeTruthy();
  });

  it("allows artifact edits before approve", async () => {
    const job = await createDeskJob({
      topic: "Editable artifact",
      audience: "Authors",
      offerCta: "Save then approve",
      channels: ["newsletter"],
      actorEmail: "author@matos.local",
    });
    await runDeskStage({
      jobId: job.id,
      actorEmail: "author@matos.local",
    });
    const edited = await updateDeskArtifact({
      jobId: job.id,
      body: "# Edited scout\n\nHuman override.",
      actorEmail: "author@matos.local",
    });
    expect(edited.artifacts[0]?.body).toContain("Human override");
    expect(edited.status).toBe("awaiting_approval");
    expect(edited.artifacts[0]?.revisions.length).toBeGreaterThanOrEqual(1);
    expect(edited.artifacts[0]?.revisions[0]?.body).not.toContain("Human override");
  });
});
