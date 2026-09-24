import { NextResponse } from "next/server";
import { requireDeskApprove } from "@/lib/owner";
import { clientSafeError } from "@/lib/client-safe-error";
import { ingestContentMetric, validateMetricDraft } from "@/lib/content-metrics";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireDeskApprove();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  try {
    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const metric = await ingestContentMetric(
      validateMetricDraft({ ...body, publicationId: id }),
    );
    return NextResponse.json({
      metric: {
        id: metric.id,
        publicationId: metric.publicationId,
        kind: metric.kind,
        value: metric.value,
        capturedAt: metric.capturedAt.toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: clientSafeError(error) }, { status: 400 });
  }
}
