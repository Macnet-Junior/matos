import { NextResponse } from "next/server";
import { requireDeskRun } from "@/lib/owner";
import { YoutubeSkillInputError, retryYoutubeSkill } from "@/lib/desk/youtube-source";

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
    const started = await retryYoutubeSkill({
      sourceId: id,
      actorEmail: gate.email,
    });
    return NextResponse.json({ source: started.source, grade: started.grade });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not retry";
    const status = err instanceof YoutubeSkillInputError && message === "Source not found" ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
