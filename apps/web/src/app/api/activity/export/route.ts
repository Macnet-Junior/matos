import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { requireActivityExport } from "@/lib/owner";
import { toActivityDTO } from "@/lib/map-data";

export const dynamic = "force-dynamic";

/** Owner-only full activity JSON download. */
export async function GET() {
  const gate = await requireActivityExport();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const rows = await prisma.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
  });
  const events = rows.map(toActivityDTO);
  const body = {
    exportedAt: new Date().toISOString(),
    exportedBy: gate.email,
    count: events.length,
    events,
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="matos-activity-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
