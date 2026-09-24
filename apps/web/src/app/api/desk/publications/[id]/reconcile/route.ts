import { NextResponse } from "next/server";
import { requireDeskApprove } from "@/lib/owner";
import { clientSafeError } from "@/lib/client-safe-error";
import { reconcileDeskPublication } from "@/lib/content-publications";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireDeskApprove();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  try {
    const { id } = await params;
    const publication = await reconcileDeskPublication({
      publicationId: id,
      actorEmail: gate.email,
    });
    return NextResponse.json({
      publication: {
        id: publication.id,
        status: publication.status,
        externalId: publication.externalId,
        error: publication.error,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: clientSafeError(error) }, { status: 400 });
  }
}
