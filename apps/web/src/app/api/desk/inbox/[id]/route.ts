import { NextResponse } from "next/server";
import { requireDeskApprove } from "@/lib/owner";
import { deskInboxActionSchema } from "@/lib/validation";
import { actOnInboxItem } from "@/lib/desk";

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
  const parsed = deskInboxActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;
  try {
    const item = await actOnInboxItem({
      id,
      action: parsed.data.action,
      actorEmail: gate.email,
    });
    return NextResponse.json({ item });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Action failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
