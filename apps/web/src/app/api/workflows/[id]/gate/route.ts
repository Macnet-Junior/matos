import { NextResponse } from "next/server";
import { requireWorkflowApprove } from "@/lib/owner";
import { advanceGateSchema } from "@/lib/validation";
import { appendActivity } from "@/lib/map-data";
import { advanceWorkflowGate } from "@/lib/workflows";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireWorkflowApprove();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = advanceGateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const workflow = await advanceWorkflowGate({
      workflowId: id,
      to: parsed.data.to,
    });
    await appendActivity({
      action: "workflow.approve",
      entityType: "workflow",
      entityId: id,
      summary: `Advanced workflow ${workflow.slug} gate → ${parsed.data.to}`,
      actorEmail: gate.email,
      payload: { to: parsed.data.to },
    });
    return NextResponse.json({ workflow });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gate advance failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
