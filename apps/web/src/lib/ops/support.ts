import { prisma } from "@matos/db";
import { appendActivity } from "@/lib/map-data";
import type { Role } from "@/lib/rbac";

export const TICKET_STATUSES = ["open", "pending", "solved"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high"] as const;

export function canOpsSupport(role: Role): boolean {
  return role === "Owner" || role === "Operator";
}

export async function createTicket(input: {
  subject: string;
  body: string;
  priority?: string;
  requesterEmail: string;
}) {
  const priority = TICKET_PRIORITIES.includes(
    (input.priority as (typeof TICKET_PRIORITIES)[number]) ?? "normal",
  )
    ? input.priority!
    : "normal";

  const ticket = await prisma.supportTicket.create({
    data: {
      subject: input.subject.trim(),
      body: input.body.trim(),
      priority,
      requesterEmail: input.requesterEmail,
      status: "open",
      messages: {
        create: {
          authorEmail: input.requesterEmail,
          body: input.body.trim(),
          kind: "comment",
        },
      },
    },
    include: { messages: true },
  });

  await appendActivity({
    action: "support.ticket.create",
    entityType: "support_ticket",
    entityId: ticket.id,
    summary: `Support ticket: ${ticket.subject}`,
    actorEmail: input.requesterEmail,
    payload: { priority: ticket.priority },
  });

  return ticket;
}

export async function listTicketsFor(input: {
  email: string;
  role: Role;
}) {
  if (canOpsSupport(input.role)) {
    return prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  }
  return prisma.supportTicket.findMany({
    where: { requesterEmail: input.email },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
}

export async function updateTicketStatus(input: {
  ticketId: string;
  status: string;
  assigneeEmail?: string | null;
  actorEmail: string;
  role: Role;
}) {
  if (!canOpsSupport(input.role)) {
    return { ok: false as const, error: "Forbidden", status: 403 as const };
  }
  if (!TICKET_STATUSES.includes(input.status as (typeof TICKET_STATUSES)[number])) {
    return { ok: false as const, error: "Invalid status", status: 400 as const };
  }
  const ticket = await prisma.supportTicket.update({
    where: { id: input.ticketId },
    data: {
      status: input.status,
      ...(input.assigneeEmail !== undefined
        ? { assigneeEmail: input.assigneeEmail }
        : {}),
    },
  });
  await appendActivity({
    action: "support.ticket.update",
    entityType: "support_ticket",
    entityId: ticket.id,
    summary: `Ticket ${ticket.subject} → ${ticket.status}`,
    actorEmail: input.actorEmail,
  });
  return { ok: true as const, ticket };
}
