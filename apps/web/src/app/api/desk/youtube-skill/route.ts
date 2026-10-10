import { NextResponse } from "next/server";
import { requireDeskRun } from "@/lib/owner";
import { YoutubeSkillInputError, startYoutubeSkill } from "@/lib/desk/youtube-source";
import { youtubeSkillRequestError, youtubeSkillSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireDeskRun();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = youtubeSkillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: youtubeSkillRequestError(body, parsed.error) },
      { status: 400 },
    );
  }

  try {
    const started = await startYoutubeSkill({
      jobId: parsed.data.jobId,
      title: parsed.data.title,
      youtubeUrl: parsed.data.youtubeUrl,
      transcript: parsed.data.transcript,
      actorEmail: gate.email,
    });
    return NextResponse.json({ source: started.source, grade: started.grade });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not draft a skill";
    const status = err instanceof YoutubeSkillInputError && message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
