import { NextResponse } from "next/server";
import { requireDeskApprove } from "@/lib/owner";
import { publishDeskCalendarItem } from "@/lib/content-publications";

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
    const publication = await publishDeskCalendarItem({
      calendarItemId: id,
      actorEmail: gate.email,
    });
    return NextResponse.json({ publication });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}