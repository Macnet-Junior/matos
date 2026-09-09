import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { requireSupportUse } from "@/lib/owner";
import { matchFaq } from "@/lib/ops/faq";
import { appendActivity } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireSupportUse();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("threadId");

  if (threadId) {
    const thread = await prisma.chatThread.findFirst({
      where: { id: threadId, userEmail: gate.email },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!thread) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      thread: {
        id: thread.id,
        title: thread.title,
        messages: thread.messages.map((m) => ({
          id: m.id,
          role: m.role,
          body: m.body,
          metaJson: m.metaJson,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  }

  const threads = await prisma.chatThread.findMany({
    where: { userEmail: gate.email },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return NextResponse.json({
    threads: threads.map((t) => ({
      id: t.id,
      title: t.title,
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const gate = await requireSupportUse();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const body = (await req.json().catch(() => ({}))) as {
    threadId?: string;
    message?: string;
  };
  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  let threadId = body.threadId;
  if (!threadId) {
    const created = await prisma.chatThread.create({
      data: {
        userEmail: gate.email,
        title: message.slice(0, 60),
      },
    });
    threadId = created.id;
  } else {
    const owned = await prisma.chatThread.findFirst({
      where: { id: threadId, userEmail: gate.email },
    });
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  await prisma.chatMessage.create({
    data: {
      threadId,
      role: "user",
      body: message,
    },
  });

  const reply = await matchFaq(message);
  const assistant = await prisma.chatMessage.create({
    data: {
      threadId,
      role: "assistant",
      body: reply.text,
      metaJson: JSON.stringify({
        kind: reply.kind,
        usedLlm: reply.usedLlm,
        matches: reply.matches.map((m) => ({
          path: m.path,
          title: m.title,
          score: m.score,
        })),
      }),
    },
  });

  await prisma.chatThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  await appendActivity({
    action: "support.chat",
    entityType: "chat_thread",
    entityId: threadId,
    summary: `Support chat · ${reply.kind}`,
    actorEmail: gate.email,
    payload: { kind: reply.kind },
  });

  return NextResponse.json({
    threadId,
    reply: {
      id: assistant.id,
      role: assistant.role,
      body: assistant.body,
      kind: reply.kind,
      usedLlm: reply.usedLlm,
      matches: reply.matches,
    },
  });
}
