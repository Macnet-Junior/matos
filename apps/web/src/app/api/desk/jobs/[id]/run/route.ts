import { NextResponse } from "next/server";
import { requireDeskRun } from "@/lib/owner";
import { runDeskStage } from "@/lib/desk";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireDeskRun();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { id } = await ctx.params;
  try {
    const job = await runDeskStage({ jobId: id, actorEmail: gate.email });
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Run failed";
    const status = message.includes("not found")
      ? 404
      : message.includes("Cannot run") || message.includes("filed")
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
