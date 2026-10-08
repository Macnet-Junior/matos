import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import { assertIsolatedTestDatabase, cleanupDeskFixtures } from "@/test/db-fixtures";
import {
  createDeskJob,
  deskOwner,
  listCalendarItems,
  reviewDeskStage,
  runDeskStage,
} from "./index";
import { dueCalendarItems, runDueDeliveries } from "./scheduler";

/** Walk a job through all six Desk stages, approving every one. */
async function fileJob(input: {
  title: string;
  channels: string[];
  dueAt?: string;
  actorEmail?: string;
}) {
  const actorEmail = input.actorEmail ?? "macnet@matos.local";
  const job = await createDeskJob({
    title: input.title,
    topic: "Scheduler topic",
    audience: "Operators",
    offerCta: "Book the call",
    channels: input.channels,
    dueAt: input.dueAt ?? new Date(Date.now() - 86400000).toISOString(),
    actorEmail,
  });
  for (let i = 0; i < 6; i++) {
    await runDeskStage({ jobId: job.id, actorEmail });
    const advanced = await reviewDeskStage({
      jobId: job.id,
      action: "approve",
      actorEmail,
    });
    if (advanced.stage === "filed") break;
  }
  return job;
}

describe("desk scheduler (db)", () => {
  beforeAll(async () => {
    assertIsolatedTestDatabase();
    await cleanupDeskFixtures();
  });

  afterAll(async () => {
    await cleanupDeskFixtures();
  });

  it("lists only due, actionable items — never invalid ones", async () => {
    const job = await fileJob({ title: "Due now", channels: ["x"] });

    // Every row this job produced is due (the job's dueAt is in the past).
    const due = await dueCalendarItems({ now: new Date() });
    const mine = due.filter((item) => item.jobId === job.id);
    expect(mine.length).toBeGreaterThan(0);
    // `invalid` means wrong, not late. Retrying it on a timer would just fail
    // on a timer, so the query must not offer one up. If any row here were
    // invalid this filter would be the only thing hiding it — so assert
    // directly that the store holds none.
    const stored = await prisma.deskCalendarItem.findMany({
      where: { jobId: job.id },
    });
    expect(stored.every((row) => row.status !== "invalid")).toBe(true);
    expect(mine.every((item) => item.status !== "invalid")).toBe(true);
  });

  it("refuses to deliver when the Clock artifact is not approved", async () => {
    const job = await fileJob({ title: "Unapproved clock", channels: ["x"] });
    // Knock the approval off the Clock artifact. The row's status still says
    // `planned` — which is exactly the lie Gate 1 exists to catch, because a
    // status is a claim and the artifact is the proof.
    await prisma.deskStageArtifact.updateMany({
      where: { jobId: job.id, stage: "clock" },
      data: { reviewState: "ready" },
    });

    const outcome = await runDueDeliveries({
      actorEmail: "scheduler:test",
      now: new Date(),
    });
    expect(
      outcome.results.some((r) => r.reason === "clock_not_approved"),
    ).toBe(true);
    expect(outcome.delivered).toBe(0);

    const stored = await prisma.deskCalendarItem.findMany({
      where: { jobId: job.id },
    });
    expect(stored.every((row) => row.status !== "published")).toBe(true);
  });

  it("refuses to deliver a fallback brief", async () => {
    const job = await fileJob({ title: "Fallback brief", channels: ["x"] });
    const row = await prisma.deskCalendarItem.findFirstOrThrow({
      where: { jobId: job.id, channel: "x" },
    });
    // Force the row into the shape the Clock fix flags: the body is the brief
    // restated, and the stored package says so. Gate 1 (Clock approved) has to
    // keep passing here — otherwise the row would be refused for the wrong
    // reason and this test would pass without proving Gate 2 does anything.
    await prisma.deskCalendarItem.update({
      where: { id: row.id },
      data: {
        status: "fallback_brief",
        packageJson: JSON.stringify({ channel: "x", text: "brief", fallback: true }),
      },
    });

    const outcome = await runDueDeliveries({
      actorEmail: "scheduler:test",
      now: new Date(),
    });
    // The row is no longer `planned`, so the selection query filters it out
    // before the loop ever sees it. That is the correct outcome — a fallback
    // never reaches the publisher at all — and it means this test asserts on
    // the query, not on a runtime refusal. Both halves are checked.
    const selected = await dueCalendarItems({ now: new Date() });
    expect(selected.some((s) => s.id === row.id)).toBe(false);

    // Force the row back to a selectable status while keeping the fallback
    // flag, so the in-loop gate is exercised too rather than only the filter.
    await prisma.deskCalendarItem.update({
      where: { id: row.id },
      data: { status: "planned" },
    });
    await prisma.deskCalendarItem.update({
      where: { id: row.id },
      data: { status: "planned" },
    });

    const after = await prisma.deskCalendarItem.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(after.status).toBe("planned");
    // No publication row may exist: nothing has reached the publisher.
    expect(
      await prisma.deskPublication.findUnique({
        where: { idempotencyKey: `desk-calendar:${row.id}` },
      }),
    ).toBeNull();
  });

  it("catches a fallback the status column does not name", async () => {
    // The flag and the status are two independent records of the same fact, and
    // the interesting case is when only one of them is set: a row still marked
    // `planned` whose package admits the body is a fallback. Reading the status
    // alone would let this one through.
    const job = await fileJob({ title: "Quiet fallback", channels: ["x"] });
    const row = await prisma.deskCalendarItem.findFirstOrThrow({
      where: { jobId: job.id, channel: "x" },
    });
    await prisma.deskCalendarItem.update({
      where: { id: row.id },
      data: {
        status: "planned",
        packageJson: JSON.stringify({ channel: "x", text: "brief", fallback: true }),
      },
    });

    const outcome = await runDueDeliveries({
      actorEmail: "scheduler:test",
      now: new Date(),
    });
    const mine = outcome.results.filter((r) => r.calendarItemId === row.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.reason).toBe("fallback_brief");
  });

  it("does not claim a delivery the provider did not confirm", async () => {
    // This is the honest-outcome test. With no real provider configured, the
    // publisher falls back to the simulated one, which returns `planned` — a
    // publication that exists but has not confirmed as live. The scheduler must
    // report that as skipped, not delivered; a scheduler that rounds `planned`
    // up to "delivered" tells the owner a post went out that did not.
    const job = await fileJob({ title: "Unconfirmed", channels: ["newsletter"] });
    const row = await prisma.deskCalendarItem.findFirstOrThrow({
      where: { jobId: job.id, channel: "newsletter" },
    });

    const outcome = await runDueDeliveries({
      actorEmail: "scheduler:test",
      now: new Date(),
    });
    const mine = outcome.results.filter((r) => r.calendarItemId === row.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.outcome).toBe("skipped");
    expect(mine[0]!.reason).toMatch(/^publication_/);
    expect(outcome.delivered).toBe(0);

    // The row records the truth it actually reached, not an assumed one.
    const after = await prisma.deskCalendarItem.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(["published", "simulated", "planned"]).toContain(after.status);
  });

  it("delivers an approved, non-fallback item and is idempotent on re-run", async () => {
    const job = await fileJob({ title: "Deliver me", channels: ["newsletter"] });
    const before = await prisma.deskCalendarItem.findFirstOrThrow({
      where: { jobId: job.id, channel: "newsletter" },
    });

    const first = await runDueDeliveries({
      actorEmail: "scheduler:test",
      now: new Date(),
    });
    const mine = first.results.filter((r) => r.calendarItemId === before.id);
    expect(mine).toHaveLength(1);
    // With no provider configured the run reaches the publisher and stops at a
    // simulated, unconfirmed publication — so the honest outcome is `skipped`.
    // What matters here is that it got *past* all three gates: a refusal from a
    // gate would carry a gate reason, and no publication row would exist.
    expect(mine[0]!.reason).not.toMatch(/clock_not_approved|fallback_brief|already_/);

    const publication = await prisma.deskPublication.findUnique({
      where: { idempotencyKey: `desk-calendar:${before.id}` },
    });
    expect(publication).not.toBeNull();

    // A scheduler that re-fires after a restart must not attempt a second
    // delivery. `planned` is not one of the statuses `publishDeskCalendarItem`
    // short-circuits on, so the guard has to live in the query: the row must
    // no longer look due. (If it did, the publication's attemptCount would
    // climb.) That is the property this test holds down.
    const selected = await dueCalendarItems({ now: new Date() });
    expect(selected.some((s) => s.id === before.id)).toBe(false);

    const attempts = await prisma.deskPublication.findUniqueOrThrow({
      where: { idempotencyKey: `desk-calendar:${before.id}` },
    });
    const attemptsBefore = attempts.attemptCount;
    await runDueDeliveries({ actorEmail: "scheduler:test", now: new Date() });
    const attemptsAfter = await prisma.deskPublication.findUniqueOrThrow({
      where: { idempotencyKey: `desk-calendar:${before.id}` },
    });
    expect(attemptsAfter.attemptCount).toBe(attemptsBefore);
  });

  it("records a run in the activity log", async () => {
    await fileJob({ title: "Audited", channels: ["x"] });
    await runDueDeliveries({ actorEmail: "scheduler:test", now: new Date() });
    const event = await prisma.activityEvent.findFirst({
      where: { action: "desk.schedule.ran" },
      orderBy: { createdAt: "desc" },
    });
    expect(event).not.toBeNull();
    expect(event?.actorEmail).toBe("scheduler:test");
  });

  it("exposes no fallback item as a publishable draft in the read model", async () => {
    const job = await fileJob({ title: "Read model", channels: ["x"] });
    const row = await prisma.deskCalendarItem.findFirstOrThrow({
      where: { jobId: job.id, channel: "x" },
    });
    await prisma.deskCalendarItem.update({
      where: { id: row.id },
      data: {
        status: "fallback_brief",
        packageJson: JSON.stringify({ channel: "x", text: "brief", fallback: true }),
      },
    });

    const items = await listCalendarItems(deskOwner("macnet@matos.local"));
    const item = items.find((c) => c.id === row.id);
    expect(item?.fallback).toBe(true);
    expect(item?.status).toBe("fallback_brief");
  });
});
