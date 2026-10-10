import { prisma } from "@matos/db";
import { ActivityEntry } from "@/components/ActivityEntry";
import { ActivityExportButton } from "@/components/ActivityExportButton";
import { presentActivity } from "@/lib/activity-present";
import { toActivityDTO } from "@/lib/map-data";
import { getSessionFlags } from "@/lib/owner";

export const dynamic = "force-dynamic";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
  });
}

export default async function Page() {
  const { canExportActivity } = await getSessionFlags();
  const rows = await prisma.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const events = await presentActivity(rows.map(toActivityDTO));

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-matos-soft px-[22px] py-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Activity</h1>
          <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
            Append-only trail of map mutations, workflow create/run/approve, and
            layout changes.
          </p>
        </div>
        <ActivityExportButton enabled={canExportActivity} />
      </div>
      <div className="space-y-2 overflow-auto p-[22px]">
        {events.length === 0 ? (
          <div className="rounded-xl border border-matos-border bg-matos-panel p-4 text-xs text-matos-muted">
            No activity yet.
          </div>
        ) : (
          events.map((event) => (
            <ActivityEntry
              key={event.id}
              summary={event.summary}
              actionLabel={event.actionLabel}
              href={event.href}
              when={formatWhen(event.createdAt)}
              actorEmail={event.actorEmail}
            />
          ))
        )}
      </div>
    </main>
  );
}
