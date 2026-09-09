import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { requireOpsManage, requireOpsView } from "@/lib/owner";
import {
  CREDIT_PRICING,
  WORKSPACE_USER_ID,
  appendCreditEntry,
  consumptionForPeriod,
  estimateUsd,
  latestBalance,
} from "@/lib/ops/billing";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireOpsView();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days") ?? 30), 90);
  const since = new Date(Date.now() - days * 86_400_000);
  const balance = await latestBalance(WORKSPACE_USER_ID);
  const ledger = await prisma.creditLedger.findMany({
    where: { userId: WORKSPACE_USER_ID },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const period = await consumptionForPeriod(since);
  return NextResponse.json({
    stripeStatus: "Stripe connect — Phase 4b later",
    pricing: CREDIT_PRICING,
    balance,
    balanceUsd: estimateUsd(balance),
    period,
    ledger: ledger.map((r) => ({
      id: r.id,
      entryType: r.entryType,
      units: r.units,
      balanceAfter: r.balanceAfter,
      note: r.note,
      actorEmail: r.actorEmail,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

/** Owner-only credit grant / adjust */
export async function POST(req: Request) {
  const gate = await requireOpsManage();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const body = (await req.json().catch(() => ({}))) as {
    entryType?: "grant" | "adjust";
    units?: number;
    note?: string;
  };
  if (body.entryType !== "grant" && body.entryType !== "adjust") {
    return NextResponse.json({ error: "entryType must be grant|adjust" }, { status: 400 });
  }
  const units = Number(body.units);
  if (!Number.isFinite(units) || units === 0) {
    return NextResponse.json({ error: "units required" }, { status: 400 });
  }
  const row = await appendCreditEntry({
    entryType: body.entryType,
    units,
    note: body.note ?? `Owner ${body.entryType}`,
    actorEmail: gate.email,
  });
  return NextResponse.json({
    id: row.id,
    balanceAfter: row.balanceAfter,
    units: row.units,
  });
}
