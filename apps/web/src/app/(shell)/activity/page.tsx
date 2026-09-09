import { prisma } from "@matos/db";
import { toActivityDTO } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export default async function Page() {
  const rows = await prisma.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const events = rows.map(toActivityDTO);

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Activity</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Append-only trail of map mutations and layout changes.
        </p>
      </div>
      <div className="space-y-2 overflow-auto p-[22px]">
        {events.length === 0 ? (
          <div className="rounded-xl border border-matos-border bg-matos-panel p-4 text-xs text-matos-muted">
            No activity yet.
          </div>
        ) : (
          events.map((e) => (
            <article
              key={e.id}
              className="rounded-xl border border-matos-border bg-matos-panel px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xs font-semibold tracking-tight">
                    {e.summary}
                  </h2>
                  <p className="mt-1 font-mono text-[11px] text-matos-muted2">
                    {e.action} · {e.entityType}/{e.entityId}
                  </p>
                </div>
                <time className="shrink-0 text-[11px] text-matos-muted2">
                  {new Date(e.createdAt).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                  })}
                </time>
              </div>
              {e.actorEmail ? (
                <p className="mt-2 text-[11px] text-matos-muted">
                  {e.actorEmail}
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </main>
  );
}
