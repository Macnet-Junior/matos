import { NextResponse } from "next/server";
import { requireDeskApprove } from "@/lib/owner";
import { clientSafeError } from "@/lib/client-safe-error";
import {
  createPerformanceInsight,
  linkReviewedInsight,
  reviewPerformanceInsight,
} from "@/lib/content-insights";

export async function POST(req: Request) {
  const gate = await requireDeskApprove();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  try {
    const body = (await req.json()) as {
      action?: string;
      summary?: string;
      publicationId?: string;
      insightId?: string;
      skillSlug?: string;
      knowledgePath?: string;
    };
    if (body.action === "review" && body.insightId) {
      const insight = await reviewPerformanceInsight({
        insightId: body.insightId,
        actorEmail: gate.email,
      });
      return NextResponse.json({ insight });
    }
    if (body.action === "link" && body.insightId) {
      const insight = await linkReviewedInsight({
        insightId: body.insightId,
        skillSlug: body.skillSlug,
        knowledgePath: body.knowledgePath,
        actorEmail: gate.email,
      });
      return NextResponse.json({ insight });
    }
    const insight = await createPerformanceInsight({
      summary: body.summary ?? "",
      publicationId: body.publicationId,
      actorEmail: gate.email,
    });
    return NextResponse.json({ insight });
  } catch (error) {
    return NextResponse.json({ error: clientSafeError(error) }, { status: 400 });
  }
}
