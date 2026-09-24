import { redirect } from "next/navigation";
import { Badge } from "@matos/ui";
import { prisma } from "@matos/db";
import { getSessionFlags } from "@/lib/owner";
import {
  CREDIT_PRICING,
  WORKSPACE_USER_ID,
  consumptionForPeriod,
  estimateUsd,
  latestBalance,
  stripeBillingGate,
} from "@/lib/ops/billing";
import { BillingGrantForm } from "@/components/ops/BillingGrantForm";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await getSessionFlags();
  if (!flags.canViewOps) redirect("/home");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const balance = await latestBalance(WORKSPACE_USER_ID);
  const period = await consumptionForPeriod(since);
  const stripe = stripeBillingGate();
  const ledger = await prisma.creditLedger.findMany({
    where: { userId: WORKSPACE_USER_ID },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-semibold tracking-tight">
            Charges & consumption
          </h1>
          <Badge tone="muted">Stripe disabled</Badge>
        </div>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          {stripe.reason} Credit ledger stays local. No card charges run from MatOS.
        </p>
      </div>
      <div className="grid gap-4 overflow-auto p-[22px] lg:grid-cols-3">
        <div className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Balance
          </div>
          <div className="mt-2 text-3xl font-bold text-matos-citron">
            {balance}
          </div>
          <p className="mt-1 text-xs text-matos-muted">
            ≈ ${estimateUsd(balance).toFixed(2)} @ $
            {CREDIT_PRICING.usdPerCredit}/credit
          </p>
        </div>
        <div className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Period consume (30d)
          </div>
          <div className="mt-2 text-3xl font-bold">{period.consumed}</div>
          <p className="mt-1 text-xs text-matos-muted">
            Est. ${period.estimatedUsd.toFixed(2)} · {period.entries} entries
          </p>
        </div>
        <div className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <div className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Pricing stub
          </div>
          <ul className="mt-2 space-y-1 text-[11px] text-matos-muted">
            {Object.entries(CREDIT_PRICING.kinds).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2">
                <span>{v.label}</span>
                <span className="font-mono">{v.creditsPerUnit} cr</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-3">
          <BillingGrantForm canManage={flags.canManageOps} />
        </div>
        <section className="lg:col-span-3 rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Ledger
          </h2>
          <ul className="mt-3 space-y-2">
            {ledger.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-matos-soft pt-2 text-[11px]"
              >
                <span>
                  <span className="font-semibold">{r.entryType}</span>{" "}
                  <span className="text-matos-muted">{r.note || "—"}</span>
                </span>
                <span className="font-mono text-matos-muted2">
                  {r.units > 0 ? "+" : ""}
                  {r.units} → {r.balanceAfter}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
