import { prisma } from "@matos/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanupDeskFixtures } from "@/test/db-fixtures";
import {
  createDeskJob,
  getDeskJob,
  listCalendarItems,
  listDeskJobs,
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
   * This is the finding, not a passing assertion. `listDeskJobs` takes no
   * actor and filters only by stage, so an unfiltered view returns every
   * owner's work. The test documents the current behaviour; when the list
   * functions grow an owner scope, this expectation flips to `[]` and the
   * suite becomes the regression guard for the fix.
   */
  it("currently leaks across owners through the unscoped list functions", async () => {
    const all = await listDeskJobs();
    const ids = all.map((j) => j.id);
    expect(ids).toContain(jobA.id);
    expect(ids).toContain(jobB.id);

    const calendar = await listCalendarItems();
    const jobIds = new Set(calendar.map((c) => c.jobId));
    // No calendar items yet (nothing past Clock), but the query itself is
    // unscoped — it filters by nothing but scheduledAt ordering.
    expect([...jobIds].every((id) => id === jobA.id || id === jobB.id)).toBe(true);
  });

  it("scopes a single job fetch to exactly one owner's row", async () => {
    const dtoA = await getDeskJob(jobA.id);
    expect(dtoA?.id).toBe(jobA.id);
    expect(dtoA?.createdBy).toBe(OWNER_A);
    expect(dtoA?.id).not.toBe(jobB.id);
  });
});
