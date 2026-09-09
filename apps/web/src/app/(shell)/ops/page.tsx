import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFlags } from "@/lib/owner";
import { listPresence } from "@/lib/ops/presence";

export const dynamic = "force-dynamic";

const links = [
  { href: "/ops/feed", label: "Live feed", desc: "Activity stream · poll 4s" },
  { href: "/ops/presence", label: "Presence", desc: "Who is online" },
  { href: "/ops/usage", label: "Usage", desc: "Resource meters" },
  { href: "/ops/billing", label: "Billing", desc: "Credits · stub Stripe" },
  { href: "/ops/auto-response", label: "Auto-response", desc: "Approved rules only" },
];

export default async function Page() {
  const flags = await getSessionFlags();
  if (!flags.canViewOps) redirect("/home");
  const presence = await listPresence();

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Ops</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Live feed, presence, usage meters, credits, and gated auto-response.
          Owner/Operator only.
        </p>
      </div>
      <div className="grid gap-3 p-[22px] sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-matos-citron/40 bg-[rgba(214,243,31,0.08)] p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Online now
          </div>
          <div className="mt-2 text-3xl font-bold text-matos-citron">
            {presence.onlineCount}
          </div>
          <p className="mt-1 text-[11px] text-matos-muted">
            Heartbeat window {Math.round(presence.windowMs / 1000)}s
          </p>
        </div>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border border-matos-border bg-matos-panel p-4 hover:border-matos-citron"
          >
            <div className="text-sm font-semibold">{l.label}</div>
            <p className="mt-1 text-[11px] text-matos-muted">{l.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
