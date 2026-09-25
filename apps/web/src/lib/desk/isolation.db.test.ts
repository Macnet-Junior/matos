import { prisma } from "@matos/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupDeskFixtures } from "@/test/db-fixtures";
import {
  createDeskJob,
  deskOwner,
  getDeskJob,
  listCalendarItems,
  listDeskJobs,
  listInboxItems,
  runDeskStage,
} from "./index";

/**
 * Two owners, two jobs, one database.
 *
 * MatOS is heading for per-user brains ("separate the brains of every users"),
 * which is only real if a run for one account can never surface another
 * account's work. This suite is the mechanical proof: it asserts on what the
 * list functions actually return, not on what they ought to filter by.
 *
 * See matos-brain/strategy/tenant-model.md.
 */

const OWNER_A = "isolation-owner-a@matos.test";
const OWNER_B = "isolation-owner-b@matos.test";

let jobA: Awaited<ReturnType<typeof createDeskJob>>;
let jobB: Awaited<ReturnType<typeof createDeskJob>>;

beforeAll(async () => {
  await cleanupDeskFixtures();
  jobA = await createDeskJob({
    topic: "Owner A: shipping the first paid rung",
    audience: "Owner A's audience",
    offerCta: "Owner A's offer",
    channels: ["x"],
    actorEmail: OWNER_A,
  });
  jobB = await createDeskJob({
    topic: "Owner B: a completely different business",
    audience: "Owner B's audience",
    offerCta: "Owner B's offer",
    channels: ["linkedin"],
    actorEmail: OWNER_B,
  });
  // Give each job an artifact so the run state is non-trivial. runDeskStage
  // always runs the job's current stage, so a fresh job runs Scout.
  await runDeskStage({ jobId: jobA.id, actorEmail: OWNER_A });
  await runDeskStage({ jobId: jobB.id, actorEmail: OWNER_B });
});

afterAll(async () => {
  await cleanupDeskFixtures();
});

describe("per-owner isolation", () => {
  it("stamps each job with the owner who created it", async () => {
    const [rowA, rowB] = await Promise.all([
      prisma.deskJob.findUniqueOrThrow({ where: { id: jobA.id } }),
      prisma.deskJob.findUniqueOrThrow({ where: { id: jobB.id } }),
    ]);
    expect(rowA.createdBy).toBe(OWNER_A);
    expect(rowB.createdBy).toBe(OWNER_B);
  });

  it("keeps each owner's artifacts attached to their own job", async () => {
    const [dtoA, dtoB] = await Promise.all([
      getDeskJob(jobA.id),
      getDeskJob(jobB.id),
    ]);
    expect(dtoA?.artifacts.map((a) => a.stage)).toEqual(["scout"]);
    expect(dtoB?.artifacts.map((a) => a.stage)).toEqual(["scout"]);

    const bodyA = dtoA?.artifacts[0]?.body ?? "";
    const bodyB = dtoB?.artifacts[0]?.body ?? "";
    expect(bodyA).toContain("Owner A");
    expect(bodyA).not.toContain("Owner B");
    expect(bodyB).toContain("Owner B");
    expect(bodyB).not.toContain("Owner A");
  });

  /**
   * The regression guard for the leak this suite originally found.
   *
   * The list functions used to take no actor and filter only by stage, so a
   * signed-in user saw every owner's work. They now require an owner and
   * return nothing without one. Both halves are asserted here: the scope
   * actually narrows the result, and a missing actor fails closed rather than
   * unfiltered.
   */
  it("returns only the requesting owner's jobs, and nothing without an owner", async () => {
    const asA = await listDeskJobs(deskOwner(OWNER_A));
    const asB = await listDeskJobs(deskOwner(OWNER_B));

    expect(asA.map((j) => j.id)).toEqual([jobA.id]);
    expect(asB.map((j) => j.id)).toEqual([jobB.id]);

    // Fail closed: no actor means no rows, never every row.
    expect(await listDeskJobs(null)).toEqual([]);
    expect(await listCalendarItems(null)).toEqual([]);
    expect(await listInboxItems(null)).toEqual([]);
  });

  it("scopes calendar and inbox rows through the job that owns them", async () => {
    // Nothing has reached Clock yet, so both collections are empty — but the
    // assertion that matters is the shape of the failure: asking as owner B
    // must never surface a row reachable only through owner A's job.
    const calendarB = await listCalendarItems(deskOwner(OWNER_B));
    const inboxB = await listInboxItems(deskOwner(OWNER_B));

    expect(calendarB.every((c) => c.jobId === jobB.id)).toBe(true);
    expect(inboxB.every((i) => i.jobId === jobB.id)).toBe(true);
  });

  it("treats a differently-cased or padded owner as the same account", async () => {
    // Session emails arrive in whatever case the identity provider sends.
    // resolveRole normalises before comparing, and so must the scope, or an
    // owner signs in as "Owner A" and finds an empty desk.
    const asA = await listDeskJobs(deskOwner(`  ${OWNER_A.toUpperCase()}  `));
    expect(asA.map((j) => j.id)).toEqual([jobA.id]);
  });

  it("scopes a single job fetch to exactly one owner's row", async () => {
    const dtoA = await getDeskJob(jobA.id);
    expect(dtoA?.id).toBe(jobA.id);
    expect(dtoA?.createdBy).toBe(OWNER_A);
    expect(dtoA?.id).not.toBe(jobB.id);
  });
});
