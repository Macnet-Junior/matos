import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deskOwner } from "@/lib/desk";
import { createDeskSource, listDeskSources } from "@/lib/desk/sources";
import { requireDeskRun } from "@/lib/owner";
import { createDeskSourceSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId") ?? undefined;
  const owner = deskOwner(session.user.email);
  const sources = await listDeskSources(owner, jobId ? { jobId } : undefined);
  return NextResponse.json({ sources });
}

export async function POST(req: Request) {
  const gate = await requireDeskRun();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = createDeskSourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // A source is registered before it is transcribed, and it is registered
  // `pending`. Creating it is not a claim that a transcript exists — that claim
  // is only ever made by an ingest that actually produced speech.
  const source = await createDeskSource({
    kind: parsed.data.kind,
    title: parsed.data.title,
    origin: parsed.data.origin,
    jobId: parsed.data.jobId ?? null,
    actorEmail: gate.email,
  });

  return NextResponse.json({ source }, { status: 201 });
}
