import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireDeskRun } from "@/lib/owner";
import { createDeskBriefSchema } from "@/lib/validation";
import { createDeskJob, deskOwner, listDeskJobs, listFiledDeskJobs } from "@/lib/desk";
import { assertWhatsAppDestinationAllowed, whatsappAllowlistFromEnv } from "@/lib/integrations/whatsapp";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const filed = url.searchParams.get("filed") === "1";
  const owner = deskOwner(session.user.email);
  const jobs = filed
    ? await listFiledDeskJobs(owner)
    : await listDeskJobs(owner);
  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const gate = await requireDeskRun();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = createDeskBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let whatsappTo: string | null = null;
  if (parsed.data.channels.includes("whatsapp")) {
    const allowlist = whatsappAllowlistFromEnv();
    const requested = parsed.data.whatsappTo?.trim() || allowlist.defaultTo || "";
    const check = assertWhatsAppDestinationAllowed(
      requested,
      allowlist.destinations.map((entry) => entry.to),
    );
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
    whatsappTo = check.to;
  }

  const job = await createDeskJob({
    title: parsed.data.title,
    topic: parsed.data.topic,
    audience: parsed.data.audience,
    offerCta: parsed.data.offerCta,
    channels: parsed.data.channels,
    dueAt: parsed.data.dueAt ?? null,
    whatsappTo,
    actorEmail: gate.email,
  });
  return NextResponse.json({ job }, { status: 201 });
}
