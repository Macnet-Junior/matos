#!/usr/bin/env node
/**
 * Hosted migration check.
 * Fails when DATABASE_URL points at the development database in production
 * or when Prisma reports pending migrations.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databaseUrl = process.env.DATABASE_URL ?? "";

if (process.env.NODE_ENV === "production" && databaseUrl.includes("dev.db")) {
  console.error("Refusing production migration check against the development database.");
  process.exit(1);
}
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

let output = "";
try {
  output = execFileSync("pnpm", ["exec", "prisma", "migrate", "status"], {
    cwd: path.join(root, "packages/db"),
    env: process.env,
    encoding: "utf8",
  });
} catch (error) {
  const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
  const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "";
  output = `${stdout}\n${stderr}`;
  console.error(output);
  process.exit(1);
}

const text = output.toLowerCase();
const pending =
  text.includes("have not yet been applied") ||
  (text.includes("following migration") && text.includes("not yet"));
if (pending || text.includes("error")) {
  console.error(output);
  process.exit(1);
}
console.log(output.trim());
