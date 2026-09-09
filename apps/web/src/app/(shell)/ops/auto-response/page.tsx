import { redirect } from "next/navigation";
import { prisma } from "@matos/db";
import { getSessionFlags } from "@/lib/owner";
import { AutoResponseDesk } from "@/components/ops/AutoResponseDesk";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await getSessionFlags();
  if (!flags.canViewOps) redirect("/home");
  const rules = await prisma.autoResponseRule.findMany({
    orderBy: { createdAt: "desc" },
    include: { attempts: { orderBy: { createdAt: "desc" }, take: 10 } },
  });

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">
          Auto-response desk
        </h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Approved rules only. Enable requires Owner/Operator + approved gate.
        </p>
      </div>
      <AutoResponseDesk
        canManage={flags.canViewOps}
        initial={rules.map((r) => ({
          id: r.id,
          name: r.name,
          triggerKeyword: r.triggerKeyword,
          channel: r.channel,
          template: r.template,
          enabled: r.enabled,
          reviewGate: r.reviewGate,
          approvedBy: r.approvedBy,
          attempts: r.attempts.map((a) => ({
            id: a.id,
            status: a.status,
            detail: a.detail,
            actorEmail: a.actorEmail,
            createdAt: a.createdAt.toISOString(),
          })),
        }))}
      />
    </main>
  );
}
