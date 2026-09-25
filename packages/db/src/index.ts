import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Vitest sets MATOS_TEST_DB in every test process (apps/web/vitest.config.ts).
 * A test process that reaches for anything other than the isolated suite
 * database is a bug in the wiring, not a warning: it would silently read and
 * write the developer's real data, and the damage is invisible because the
 * test still passes. Refuse to construct a client at all.
 *
 * The check lives here rather than in a test helper because helpers are
 * opt-in — a test that forgets to call one must still be safe.
 */
export function assertIsolatedDatabaseUrl(url: string | undefined): void {
  const normalized = (url ?? "").replace(/\\/g, "/");
  if (!normalized.includes("/.test/suite.db") || normalized.includes("dev.db")) {
    throw new Error(
      `Refusing to open ${normalized || "(unset DATABASE_URL)"} from a test process: ` +
        `MATOS_TEST_DB=isolated requires the suite database at packages/db/prisma/.test/suite.db`,
    );
  }
}

if (process.env.MATOS_TEST_DB === "isolated") {
  assertIsolatedDatabaseUrl(process.env.DATABASE_URL);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export type {
  Company,
  Department,
  Skill,
  SkillKnowledge,
  ActivityEvent,
  Workflow,
  WorkflowStep,
  WorkflowRun,
  RunStep,
  UserRole,
  IntegrationAccount,
  IntegrationCredential,
  DeskJob,
  DeskStageArtifact,
  DeskCalendarItem,
  DeskInboxItem,
} from "@prisma/client";

export function parseJsonArray(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  } catch {
    return {};
  }
}

export type EvidenceLink = { url: string; label: string };

/**
 * Parse evidenceJson. Accepts [{url,label}, ...] and legacy string[]
 * (bare strings become {url,label} with the same value).
 */
export function parseEvidenceLinks(raw: string): EvidenceLink[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    const out: EvidenceLink[] = [];
    for (const item of value) {
      if (typeof item === "string") {
        const trimmed = item.trim();
        if (!trimmed) continue;
        out.push({ url: trimmed, label: trimmed });
        continue;
      }
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const url = typeof rec.url === "string" ? rec.url.trim() : "";
        const label =
          typeof rec.label === "string" && rec.label.trim()
            ? rec.label.trim()
            : url;
        if (!url) continue;
        out.push({ url, label });
      }
    }
    return out;
  } catch {
    return [];
  }
}
