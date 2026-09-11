import { NextResponse } from "next/server";
import { requireDeskRun } from "@/lib/owner";
import { updateDeskArtifactSchema } from "@/lib/validation";
import { updateDeskArtifact } from "@/lib/desk";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireDeskRun();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const body = await req.json().catch(() => null);
  const parsed = updateDeskArtifactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;
  try {
    const job = await updateDeskArtifact({
      jobId: id,
      body: parsed.data.body,
      title: parsed.data.title,
      actorEmail: gate.email,
    });
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
