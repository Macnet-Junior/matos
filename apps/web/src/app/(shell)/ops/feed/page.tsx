import { redirect } from "next/navigation";
import { prisma } from "@matos/db";
import { getSessionFlags } from "@/lib/owner";
import { toActivityDTO } from "@/lib/map-data";
import { LiveFeedClient } from "@/components/ops/LiveFeedClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await getSessionFlags();
  if (!flags.canViewOps) redirect("/home");
  const rows = await prisma.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const events = rows.map(toActivityDTO);

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Live feed</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Logins, usage, workflow runs, publishes, support, and auto-response
          events. Filter by type · polls every few seconds.
        </p>
      </div>
      <LiveFeedClient initial={events} />
    </main>
  );
}
