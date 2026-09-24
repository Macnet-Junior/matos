import { redirect } from "next/navigation";
import { Badge } from "@matos/ui";
import { getSessionFlags } from "@/lib/owner";
import {
  listPublicationPerformance,
  summarizeContentPerformance,
} from "@/lib/content-metrics";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await getSessionFlags();
  if (!flags.canViewOps) redirect("/home");
  const [summary, publications] = await Promise.all([
    summarizeContentPerformance(),
    listPublicationPerformance(),
  ]);

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Content performance</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Aggregate publication outcomes. Simulated deliveries are counted apart
          from live totals and never include private audience fields.
        </p>
      </div>
      <div className="grid gap-4 overflow-auto p-[22px]">
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["impressions", summary.totals.impressions],
              ["clicks", summary.totals.clicks],
              ["engagement", summary.totals.engagement],
              ["conversions", summary.totals.conversions],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-matos-border bg-matos-panel p-4">
              <div className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
                Live {label}
              </div>
              <div className="mt-2 text-2xl font-bold text-matos-citron">{value}</div>
            </div>
          ))}
        </section>
        <section className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            By channel
          </h2>
          <ul className="mt-3 divide-y divide-matos-soft text-xs">
            {summary.channels.length === 0 ? (
              <li className="py-2 text-matos-muted">No publications yet.</li>
            ) : (
              summary.channels.map((channel) => (
                <li key={channel.channel} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="text-matos-text">{channel.channel}</span>
                  <span className="text-matos-muted">
                    {channel.live} live · {channel.simulated} simulated ·{" "}
                    {channel.metrics.impressions} impressions
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
        <section className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Publications
          </h2>
          <ul className="mt-3 divide-y divide-matos-soft">
            {publications.length === 0 ? (
              <li className="py-2 text-xs text-matos-muted">Nothing has been delivered.</li>
            ) : (
              publications.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                  <div>
                    <div className="text-matos-text">{item.jobTitle}</div>
                    <div className="text-matos-muted">
                      {item.channel} · {item.provider}
                    </div>
                  </div>
                  <Badge tone={item.simulated ? "danger" : "muted"}>
                    {item.simulated ? "simulated — not live" : item.status}
                  </Badge>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
