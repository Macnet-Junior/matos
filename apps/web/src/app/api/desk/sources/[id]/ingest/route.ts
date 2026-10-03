import { NextResponse } from "next/server";
import { ingestSource } from "@/lib/desk/sources";
import { requireDeskRun } from "@/lib/owner";
import { ingestDeskSourceSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requireDeskRun();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = ingestDeskSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;

  try {
    const source = await ingestSource({
      sourceId: id,
      filePath: parsed.data.filePath,
      actorEmail: gate.email,
    });

    // The status is returned rather than smoothed over. `pending` here means no
    // provider was configured and no speech was processed — the honest outcome,
    // not a failure to hide. A caller that receives 200 with `pending` and an
    // `error` explanation has been told the truth: the source is not ready to
    // brief from, and `sourceBriefMaterial` will refuse it.
    return NextResponse.json({ source });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    const status = message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
