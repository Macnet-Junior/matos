import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { requireOpsView } from "@/lib/owner";
import { toActivityDTO } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireOpsView();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 80), 200);
  const type = searchParams.get("type")?.trim();

  const rows = await prisma.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: type ? 400 : limit,
  });

  let events = rows.map(toActivityDTO);
  if (type) {
    const t = type.toLowerCase();
    events = events
      .filter(
        (e) =>
          e.action.toLowerCase().includes(t) ||
          e.entityType.toLowerCase().includes(t),
      )
      .slice(0, limit);
  } else {
    events = events.slice(0, limit);
  }

  return NextResponse.json({
    events,
    generatedAt: new Date().toISOString(),
  });
}
