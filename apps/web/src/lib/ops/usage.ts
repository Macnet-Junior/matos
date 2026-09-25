import { prisma } from "@matos/db";
import { appendActivity } from "@/lib/map-data";

export const USAGE_KINDS = [
  "ai_credit",
  "late_post",
  "etsy_call",
  "whatsapp_send",
  "api_hit",
] as const;

export type UsageKind = (typeof USAGE_KINDS)[number];

export function isUsageKind(v: string): v is UsageKind {
  return (USAGE_KINDS as readonly string[]).includes(v);
}

export async function recordUsageEvent(input: {
  userId: string;
  kind: UsageKind;
  units?: number;
  meta?: Record<string, unknown>;
  /** Also append to Activity feed */
  activity?: boolean;
}) {
  const units = input.units ?? 1;
  const row = await prisma.usageEvent.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      units,
      metaJson: JSON.stringify(input.meta ?? {}),
    },
  });

  if (input.activity !== false) {
    await appendActivity({
      action: `usage.${input.kind}`,
      entityType: "usage",
      entityId: row.id,
      summary: `Usage ${input.kind} × ${units} (${input.userId})`,
      actorEmail: input.userId,
      payload: { kind: input.kind, units, ...(input.meta ?? {}) },
    });
  }

  return row;
}

export type UsageSummary = {
  kind: UsageKind;
  units: number;
  count: number;
};

/**
 * A calendar month in UTC, as a half-open interval [start, end).
 *
 * Half-open because the alternative double-counts the boundary: a run at
 * exactly midnight on the 1st would belong to both months, or to neither,
 * depending on which comparison the caller wrote. This form has one rule and
 * no edge case.
 */
export function monthWindowInclusive(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return { start, end };
}

/**
 * Count desk runs in a window, by counting the events that were written when
 * the runs happened.
 *
 * Units, not rows: `recordUsageEvent` is called once per stage with
 * `units: 1`, but nothing stops a future caller batching a whole pipeline
 * into one row with `units: 6`. Counting rows would let that pass the cap for
 * free, so the allowance is measured in the same unit it is charged in.
 *
 * This is the deliberate choice behind "runs per month": a run is one
 * countable thing the *user* did, not a token count they cannot reason about,
 * and it is measured from the ledger rather than kept in a second counter
 * that would drift from it. No mutable counter, nothing to reset on the 1st,
 * no way for the number the user sees to disagree with the number we recorded.
 */
export async function countDeskRuns(input: {
  userId: string;
  since: Date;
  until?: Date;
}): Promise<number> {
  const rows = await prisma.usageEvent.findMany({
    where: {
      userId: input.userId,
      kind: "ai_credit",
      createdAt: input.until
        ? { gte: input.since, lt: input.until }
        : { gte: input.since },
    },
    select: { units: true },
  });
  return rows.reduce((total, row) => total + row.units, 0);
}

export async function summarizeUsage(opts?: {
  since?: Date;
  userId?: string;
}): Promise<UsageSummary[]> {
  const where: { createdAt?: { gte: Date }; userId?: string } = {};
  if (opts?.since) where.createdAt = { gte: opts.since };
  if (opts?.userId) where.userId = opts.userId;

  const rows = await prisma.usageEvent.findMany({ where, select: { kind: true, units: true } });
  const map = new Map<string, { units: number; count: number }>();
  for (const r of rows) {
    const cur = map.get(r.kind) ?? { units: 0, count: 0 };
    cur.units += r.units;
    cur.count += 1;
    map.set(r.kind, cur);
  }
  return USAGE_KINDS.map((kind) => ({
    kind,
    units: map.get(kind)?.units ?? 0,
    count: map.get(kind)?.count ?? 0,
  }));
}

export async function usageByUser(opts?: { since?: Date }) {
  const where = opts?.since ? { createdAt: { gte: opts.since } } : {};
  const rows = await prisma.usageEvent.findMany({
    where,
    select: { userId: true, kind: true, units: true },
  });
  const byUser = new Map<
    string,
    { userId: string; total: number; byKind: Record<string, number> }
  >();
  for (const r of rows) {
    const cur = byUser.get(r.userId) ?? {
      userId: r.userId,
      total: 0,
      byKind: {},
    };
    cur.total += r.units;
    cur.byKind[r.kind] = (cur.byKind[r.kind] ?? 0) + r.units;
    byUser.set(r.userId, cur);
  }
  return [...byUser.values()].sort((a, b) => b.total - a.total);
}
