import { prisma } from "@matos/db";

const SEEDED_DESK_JOBS = ["desk-job-seed-1", "desk-job-seed-2"];

/** Refuse any database that is not the isolated suite file. */
export function assertIsolatedTestDatabase(): void {
  const url = (process.env.DATABASE_URL ?? "").replace(/\\/g, "/");
  if (!url.includes("/.test/suite.db") || url.includes("dev.db")) {
    throw new Error("Refusing to run database tests outside the isolated suite database");
  }
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
