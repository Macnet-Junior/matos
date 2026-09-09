import { redirect } from "next/navigation";
import { getSessionFlags } from "@/lib/owner";
import { summarizeUsage, usageByUser } from "@/lib/ops/usage";

export const dynamic = "force-dynamic";

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#1c2030]">
      <div
        className="h-full rounded-full bg-matos-citron"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default async function Page() {
  const flags = await getSessionFlags();
  if (!flags.canViewOps) redirect("/home");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [summary, byUser] = await Promise.all([
    summarizeUsage({ since }),
    usageByUser({ since }),
  ]);
  const maxUnits = Math.max(1, ...summary.map((s) => s.units));

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Usage & resources</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Metered pulls: AI credits, Late posts, Etsy calls, WhatsApp sends, API
          hits (last 30 days).
        </p>
      </div>
      <div className="grid gap-4 overflow-auto p-[22px] lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            By kind
          </h2>
          {summary.map((s) => (
            <div key={s.kind}>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="font-mono text-matos-muted">{s.kind}</span>
                <span className="text-matos-text">
                  {s.units} u · {s.count} evt
                </span>
              </div>
              <Bar value={s.units} max={maxUnits} />
            </div>
          ))}
          <svg viewBox="0 0 320 80" className="mt-4 w-full text-matos-citron">
            {summary.map((s, i) => {
              const h = maxUnits ? (s.units / maxUnits) * 60 : 0;
              return (
                <rect
                  key={s.kind}
                  x={20 + i * 60}
                  y={70 - h}
                  width={36}
                  height={h}
                  rx={4}
                  fill="currentColor"
                  opacity={0.85}
                />
              );
            })}
          </svg>
        </section>
        <section className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            By user
          </h2>
          <div className="mt-3 overflow-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-matos-muted2">
                <tr>
                  <th className="pb-2 font-medium">User</th>
                  <th className="pb-2 font-medium">Total</th>
                  <th className="pb-2 font-medium">Breakdown</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map((u) => (
                  <tr key={u.userId} className="border-t border-matos-soft">
                    <td className="py-2 pr-2">{u.userId}</td>
                    <td className="py-2 pr-2 font-semibold">{u.total}</td>
                    <td className="py-2 font-mono text-matos-muted2">
                      {Object.entries(u.byKind)
                        .map(([k, v]) => `${k}:${v}`)
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
