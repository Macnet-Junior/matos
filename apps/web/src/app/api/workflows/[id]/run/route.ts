import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { appendActivity } from "@/lib/map-data";
import { executeDryRun } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const gate = await requireOwner();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { id } = await ctx.params;
  try {
    const run = await executeDryRun({
      workflowId: id,
      actorEmail: gate.email,
    });
    await appendActivity({
      action: "workflow.run",
      entityType: "workflow_run",
      entityId: run.id,
      summary: `Dry-run ${run.workflowSlug ?? id}: ${run.summary}`,
      actorEmail: gate.email,
      payload: {
        workflowId: id,
        status: run.status,
        gateState: run.gateState,
        dryRun: true,
      },
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Run failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
