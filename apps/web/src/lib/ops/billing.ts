import { prisma } from "@matos/db";
import { appendActivity } from "@/lib/map-data";

/**
 * Live Stripe stays off until credit accounting and reconciliation are
 * production-ready and covered by tests. Do not charge cards from this module.
 */
export const STRIPE_BILLING_ENABLED = false as const;

export function stripeBillingGate(): {
  enabled: false;
  reason: string;
} {
  return {
    enabled: STRIPE_BILLING_ENABLED,
    reason:
      "Billing waits for production credit reconciliation. Live Stripe is not enabled.",
  };
}

/** Stub pricing table — display only. No Stripe client is constructed. */
export const CREDIT_PRICING = {
  /** USD per credit unit (display only) */
  usdPerCredit: 0.02,
  /** Default grant for workspace seed */
  defaultGrant: 1000,
  kinds: {
    ai_credit: { creditsPerUnit: 1, label: "AI / credit units" },
    late_post: { creditsPerUnit: 2, label: "Late posts" },
    etsy_call: { creditsPerUnit: 1, label: "Etsy API calls" },
    whatsapp_send: { creditsPerUnit: 3, label: "WhatsApp sends" },
    api_hit: { creditsPerUnit: 0.1, label: "API route hits" },
  },
} as const;

export const WORKSPACE_USER_ID = "workspace";

export async function latestBalance(userId: string = WORKSPACE_USER_ID): Promise<number> {
  const last = await prisma.creditLedger.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return last?.balanceAfter ?? 0;
}

export async function appendCreditEntry(input: {
  userId?: string;
  entryType: "grant" | "consume" | "adjust";
  units: number;
  note?: string;
  actorEmail?: string | null;
}) {
  const userId = input.userId ?? WORKSPACE_USER_ID;
  const current = await latestBalance(userId);
  const delta =
    input.entryType === "consume" ? -Math.abs(input.units) : input.units;
  const balanceAfter = current + delta;
  const row = await prisma.creditLedger.create({
    data: {
      userId,
      entryType: input.entryType,
      units: delta,
      balanceAfter,
      note: input.note ?? "",
      actorEmail: input.actorEmail ?? null,
    },
  });
  await appendActivity({
    action: `credit.${input.entryType}`,
    entityType: "credit",
    entityId: row.id,
    summary: `Credit ${input.entryType}: ${delta > 0 ? "+" : ""}${delta} → ${balanceAfter}`,
    actorEmail: input.actorEmail,
    payload: { userId, entryType: input.entryType, units: delta, balanceAfter },
  });
  return row;
}

export function estimateUsd(credits: number): number {
  return Math.round(credits * CREDIT_PRICING.usdPerCredit * 100) / 100;
}

export async function consumptionForPeriod(since: Date) {
  const rows = await prisma.creditLedger.findMany({
    where: {
      createdAt: { gte: since },
      entryType: "consume",
    },
  });
  const consumed = rows.reduce((s, r) => s + Math.abs(r.units), 0);
  return { consumed, estimatedUsd: estimateUsd(consumed), entries: rows.length };
}
