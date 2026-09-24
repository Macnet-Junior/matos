import { NextResponse } from "next/server";
import { requireOpsView } from "@/lib/owner";
import { summarizeContentPerformance } from "@/lib/content-metrics";

export async function GET() {
  const gate = await requireOpsView();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const summary = await summarizeContentPerformance();
  return NextResponse.json({ summary });
}
