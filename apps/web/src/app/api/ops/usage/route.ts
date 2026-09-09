import { NextResponse } from "next/server";
import { requireOpsView, requireSession } from "@/lib/owner";
import {
  recordUsageEvent,
  summarizeUsage,
  usageByUser,
  isUsageKind,
} from "@/lib/ops/usage";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireOpsView();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days") ?? 30), 90);
  const since = new Date(Date.now() - days * 86_400_000);
  const [summary, byUser] = await Promise.all([
    summarizeUsage({ since }),
    usageByUser({ since }),
  ]);
  return NextResponse.json({ since: since.toISOString(), days, summary, byUser });
}

/** Internal / instrumented recording (session required) */
export async function POST(req: Request) {
  const gate = await requireSession();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!gate.canViewOps && gate.role !== "Author") {
    // Viewers may still generate api_hit via shell; allow own recording of api_hit only
  }
  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    units?: number;
    meta?: Record<string, unknown>;
  };
  if (!body.kind || !isUsageKind(body.kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  const row = await recordUsageEvent({
    userId: gate.email,
    kind: body.kind,
    units: body.units,
    meta: body.meta,
  });
  return NextResponse.json({ id: row.id });
}
