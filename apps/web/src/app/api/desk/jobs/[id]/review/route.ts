import { NextResponse } from "next/server";
import { requireDeskApprove } from "@/lib/owner";
import { deskReviewSchema } from "@/lib/validation";
import { reviewDeskStage } from "@/lib/desk";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireDeskApprove();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const body = await req.json().catch(() => null);
  const parsed = deskReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;
  try {
    const job = await reviewDeskStage({
      jobId: id,
      action: parsed.data.action,
      note: parsed.data.note,
      actorEmail: gate.email,
    });
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review failed";
    const status = message.includes("not found")
      ? 404
      : message.includes("no ready") || message.includes("filed")
        ? 409
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
