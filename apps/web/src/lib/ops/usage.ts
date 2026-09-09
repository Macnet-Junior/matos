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
