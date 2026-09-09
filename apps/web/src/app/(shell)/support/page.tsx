import { getSessionFlags } from "@/lib/owner";
import { listTicketsFor } from "@/lib/ops/support";
import { loadFaqDocs } from "@/lib/ops/faq";
import { SupportCenter } from "@/components/support/SupportCenter";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await getSessionFlags();
  const tickets = await listTicketsFor({
    email: flags.email ?? "anonymous",
    role: flags.role,
  });
  const faqs = await loadFaqDocs();

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Support center</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Tickets for all roles. Owner/Operator can update status. FAQs from{" "}
          <code className="text-matos-muted2">knowledge/support/</code>.
        </p>
      </div>
      <SupportCenter
        canOps={flags.canOpsSupport}
        faqs={faqs.map((f) => ({ path: f.path, title: f.title }))}
        initial={tickets.map((t) => ({
          id: t.id,
          subject: t.subject,
          body: t.body,
          status: t.status,
          priority: t.priority,
          requesterEmail: t.requesterEmail,
          assigneeEmail: t.assigneeEmail,
          createdAt: t.createdAt.toISOString(),
          messages: t.messages.map((m) => ({
            id: m.id,
            authorEmail: m.authorEmail,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
          })),
        }))}
      />
    </main>
  );
}
