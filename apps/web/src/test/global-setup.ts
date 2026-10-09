import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { dbPackageRoot, isolatedDatabaseUrl, isolatedSuiteDatabasePath } from "./isolated-db";

/**
 * On Windows, `pnpm` on PATH is `pnpm.cmd`. `execFile` does not spawn a shell,
 * so it never resolves that shim and fails with `spawnSync pnpm ENOENT` before
 * any test runs. A shell is required there. Linux CI keeps a direct exec.
 */
export function pnpmExecOptions(platform: NodeJS.Platform = process.platform): {
  shell: boolean;
} {
  return { shell: platform === "win32" };
}

function execPnpm(
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
): void {
  execFileSync("pnpm", args, {
    ...options,
    stdio: "inherit",
    ...pnpmExecOptions(),
  });
}

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
  execPnpm(["exec", "prisma", "migrate", "deploy"], { cwd, env });
  execPnpm(["exec", "tsx", "prisma/seed.ts"], { cwd, env });
}
