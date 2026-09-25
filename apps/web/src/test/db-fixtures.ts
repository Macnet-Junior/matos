import { assertIsolatedDatabaseUrl, prisma } from "@matos/db";

const SEEDED_DESK_JOBS = ["desk-job-seed-1", "desk-job-seed-2"];

/**
 * Refuse any database that is not the isolated suite file.
 *
 * The same invariant is enforced when the Prisma client is constructed (see
 * packages/db/src/index.ts), so a test that never calls this helper is still
 * protected. Kept as a callable wrapper so cleanup functions can fail loudly
 * and self-documentingly before they delete anything.
 */
export function assertIsolatedTestDatabase(): void {
  assertIsolatedDatabaseUrl(process.env.DATABASE_URL);
}

export async function cleanupDeskFixtures(): Promise<void> {
  assertIsolatedTestDatabase();
  await prisma.deskJob.deleteMany({
    where: { id: { notIn: SEEDED_DESK_JOBS } },
  });
}

export async function cleanupWorkflowRunFixtures(): Promise<void> {
  assertIsolatedTestDatabase();
  await prisma.runStep.deleteMany();
  await prisma.workflowRun.deleteMany();
}
