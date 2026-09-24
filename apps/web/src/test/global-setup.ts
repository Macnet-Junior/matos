import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { dbPackageRoot, isolatedDatabaseUrl, isolatedSuiteDatabasePath } from "./isolated-db";

/**
 * Builds a fresh SQLite database for the suite.
 * This file is the only database Vitest is allowed to migrate and seed.
 */
export async function setup(): Promise<void> {
  const file = isolatedSuiteDatabasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(file + suffix, { force: true });
  }
  const url = isolatedDatabaseUrl(file);
  const cwd = dbPackageRoot();
  const env = {
    ...process.env,
    DATABASE_URL: url,
    MATOS_SEED_NOW: "2026-01-15T12:00:00.000Z",
    MATOS_TEST_DB: "isolated",
  };
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    cwd,
    env,
    stdio: "inherit",
  });
  execFileSync("pnpm", ["exec", "tsx", "prisma/seed.ts"], {
    cwd,
    env,
    stdio: "inherit",
  });
}
