import { NextResponse } from "next/server";
import { requireOpsView, requireSession } from "@/lib/owner";
import { listPresence, upsertPresence } from "@/lib/ops/presence";
import { appendActivity } from "@/lib/map-data";
import { recordUsageEvent } from "@/lib/ops/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireOpsView();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const data = await listPresence();
  return NextResponse.json(data);
}

/** Heartbeat from app shell — any authenticated user */
export async function POST(req: Request) {
  const gate = await requireSession();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const body = (await req.json().catch(() => ({}))) as {
    currentPath?: string;
    login?: boolean;
  };
  const row = await upsertPresence({
    email: gate.email,
    role: gate.role,
    currentPath: body.currentPath ?? null,
  });

  if (body.login) {
    await appendActivity({
      action: "auth.login",
      entityType: "user",
      entityId: gate.email,
      summary: `Login · ${gate.email} (${gate.role})`,
      actorEmail: gate.email,
      payload: { path: body.currentPath },
    });
    await recordUsageEvent({
      userId: gate.email,
      kind: "api_hit",
      units: 1,
      meta: { route: "presence.login" },
      activity: false,
    });
  }

  return NextResponse.json({
    email: row.email,
    role: row.role,
    lastSeenAt: row.lastSeenAt.toISOString(),
    currentPath: row.currentPath,
  });
}
