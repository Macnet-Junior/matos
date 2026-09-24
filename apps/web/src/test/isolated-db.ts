import path from "node:path";
import { fileURLToPath } from "node:url";

function thisDir(): string {
  if (typeof __dirname !== "undefined") return __dirname;
  return path.dirname(fileURLToPath(import.meta.url));
}

/** apps/web/src/test -> repo root is four levels up. */
const repoRoot = path.resolve(thisDir(), "../../../..");

export function isolatedSuiteDatabasePath(): string {
  return path.join(repoRoot, "packages/db/prisma/.test/suite.db");
}

export function isolatedDatabaseUrl(file = isolatedSuiteDatabasePath()): string {
  return `file:${file.replace(/\\/g, "/")}`;
}

export function dbPackageRoot(): string {
  return path.join(repoRoot, "packages/db");
}
