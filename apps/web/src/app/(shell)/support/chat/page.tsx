import { prisma } from "@matos/db";
import { getSessionFlags } from "@/lib/owner";
import { SupportChat } from "@/components/support/SupportChat";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await getSessionFlags();
  const email = flags.email;
  const thread = email
    ? await prisma.chatThread.findFirst({
        where: { userEmail: email },
        orderBy: { updatedAt: "desc" },
        include: { messages: { orderBy: { createdAt: "asc" }, take: 40 } },
      })
    : null;

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Support chatbot</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          FAQ keyword matcher (no fake LLM without OPENAI_API_KEY). Never invents
          billing refunds — escalates to a ticket.
        </p>
      </div>
      <SupportChat
        initialThreadId={thread?.id}
        initialMessages={thread?.messages.map((m) => ({
          id: m.id,
          role: m.role,
          body: m.body,
        }))}
      />
    </main>
  );
}
