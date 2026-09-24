import { NextResponse } from "next/server";
import { requireDeskApprove } from "@/lib/owner";
import { clientSafeError } from "@/lib/client-safe-error";
import { importContentMetrics, parseMetricImport } from "@/lib/content-metrics";

export async function POST(req: Request) {
  const gate = await requireDeskApprove();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  try {
    const body = (await req.json()) as { format?: unknown; payload?: unknown };
    const format = body.format === "csv" || body.format === "json" ? body.format : null;
    if (!format || typeof body.payload !== "string") {
      return NextResponse.json({ error: "format and payload are required" }, { status: 400 });
    }
    const rows = parseMetricImport(body.payload, format);
    const metrics = await importContentMetrics(rows);
    return NextResponse.json({ imported: metrics.length });
  } catch (error) {
    return NextResponse.json({ error: clientSafeError(error) }, { status: 400 });
  }
}
