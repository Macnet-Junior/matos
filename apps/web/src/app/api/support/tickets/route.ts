import { NextResponse } from "next/server";
import { requireSupportOps, requireSupportUse } from "@/lib/owner";
import {
  createTicket,
  listTicketsFor,
  updateTicketStatus,
} from "@/lib/ops/support";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireSupportUse();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const tickets = await listTicketsFor({ email: gate.email, role: gate.role });
  return NextResponse.json({
    tickets: tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      body: t.body,
      status: t.status,
      priority: t.priority,
      requesterEmail: t.requesterEmail,
      assigneeEmail: t.assigneeEmail,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      messages: t.messages.map((m) => ({
        id: m.id,
        authorEmail: m.authorEmail,
        body: m.body,
        kind: m.kind,
        createdAt: m.createdAt.toISOString(),
      })),
    })),
  });
}

export async function POST(req: Request) {
  const gate = await requireSupportUse();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const body = (await req.json().catch(() => ({}))) as {
    subject?: string;
    body?: string;
    priority?: string;
    action?: string;
    ticketId?: string;
    status?: string;
    assigneeEmail?: string | null;
  };

  if (body.action === "update") {
    const ops = await requireSupportOps();
    if (!ops.ok) {
      return NextResponse.json({ error: ops.error }, { status: ops.status });
    }
    if (!body.ticketId || !body.status) {
      return NextResponse.json({ error: "ticketId + status required" }, { status: 400 });
    }
    const res = await updateTicketStatus({
      ticketId: body.ticketId,
      status: body.status,
      assigneeEmail: body.assigneeEmail,
      actorEmail: ops.email,
      role: ops.role,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({ ticket: res.ticket });
  }

  if (!body.subject?.trim() || !body.body?.trim()) {
    return NextResponse.json({ error: "subject and body required" }, { status: 400 });
  }
  const ticket = await createTicket({
    subject: body.subject,
    body: body.body,
    priority: body.priority,
    requesterEmail: gate.email,
  });
  return NextResponse.json({ ticket }, { status: 201 });
}
