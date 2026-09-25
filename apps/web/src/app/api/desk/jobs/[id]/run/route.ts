import { NextResponse } from "next/server";
import { requireDeskRun } from "@/lib/owner";
import { runDeskStage } from "@/lib/desk";
import { canRunDesk } from "@/lib/tiers";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireDeskRun();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  // The allowance is checked before the model is called, not after. A run
  // that is going to be refused must cost us nothing — billing the tokens and
  // then declining is the worst of both.
  const allowance = await canRunDesk({ email: gate.email });
  if (!allowance.ok) {
    return NextResponse.json(
      { error: allowance.reason, status: allowance.status },
      { status: 402 },
    );
  }

  const { id } = await ctx.params;
  try {
    const job = await runDeskStage({ jobId: id, actorEmail: gate.email });
    // The post-run reading, so the caller can show "3 of 30 this month"
    // without a second request guessing whether the run counted.
    const after = await canRunDesk({ email: gate.email });
    return NextResponse.json({ job, tier: after.status });
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
