import { NextResponse } from "next/server";
import { requireWorkflowApprove } from "@/lib/owner";
import { advanceGateSchema } from "@/lib/validation";
import { appendActivity } from "@/lib/map-data";
import { advanceRunGate } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ runId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireWorkflowApprove();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { runId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = advanceGateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const run = await advanceRunGate({
      runId,
      to: parsed.data.to,
      actorEmail: gate.email,
    });
    await appendActivity({
      action: "workflow.approve",
      entityType: "workflow_run",
      entityId: runId,
      summary: `Advanced run gate → ${parsed.data.to}${
        parsed.data.to === "published" ? " (simulated)" : ""
      }`,
      actorEmail: gate.email,
      payload: { to: parsed.data.to, simulated: parsed.data.to === "published" },
    });
    return NextResponse.json({ run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gate advance failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
