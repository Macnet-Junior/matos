import { redirect } from "next/navigation";
import { Badge } from "@matos/ui";
import { getSessionFlags } from "@/lib/owner";
import { listPresence } from "@/lib/ops/presence";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await getSessionFlags();
  if (!flags.canViewOps) redirect("/home");
  const { people, onlineCount, windowMs } = await listPresence();

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Presence</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Heartbeat every ~30s from the app shell.{" "}
          <span className="text-matos-citron font-semibold">{onlineCount} online</span>{" "}
          (window {Math.round(windowMs / 1000)}s).
        </p>
      </div>
      <div className="space-y-2 overflow-auto p-[22px]">
        {people.length === 0 ? (
          <div className="rounded-xl border border-matos-border bg-matos-panel p-4 text-xs text-matos-muted">
            No presence rows yet — open any shell page while logged in.
          </div>
        ) : (
          people.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-matos-border bg-matos-panel px-3.5 py-3"
            >
              <div>
                <div className="text-xs font-semibold">{p.email}</div>
                <div className="mt-1 font-mono text-[11px] text-matos-muted2">
                  {p.currentPath ?? "—"} · last{" "}
                  {new Date(p.lastSeenAt).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                  })}
                </div>
              </div>
              <div className="flex gap-1.5">
                <Badge tone={p.online ? "citron" : "muted"}>
                  {p.online ? "online" : "away"}
                </Badge>
                <Badge tone="muted">{p.role}</Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
