"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BillingGrantForm({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [units, setUnits] = useState("100");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canManage) {
    return (
      <p className="text-[11px] text-matos-muted2">
        Only Owner can adjust credit grants.
      </p>
    );
  }

  async function submit(entryType: "grant" | "adjust") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ops/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryType,
          units: Number(units),
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Failed");
      } else {
        setMsg(`Balance now ${data.balanceAfter}`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-matos-border bg-matos-elev p-3">
      <h3 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
        Adjust credit grant
      </h3>
      <div className="flex flex-wrap gap-2">
        <input
          className="w-28 rounded-lg border border-matos-border bg-matos-bg px-2 py-1.5 text-xs"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          type="number"
          step="1"
        />
        <input
          className="min-w-[160px] flex-1 rounded-lg border border-matos-border bg-matos-bg px-2 py-1.5 text-xs"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit("grant")}
          className="rounded-lg bg-matos-citron px-3 py-1.5 text-[11px] font-bold text-[#0b0c0e] disabled:opacity-50"
        >
          Grant
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit("adjust")}
          className="rounded-lg border border-matos-border px-3 py-1.5 text-[11px] font-semibold text-matos-muted hover:text-matos-text disabled:opacity-50"
        >
          Adjust
        </button>
      </div>
      {msg ? <p className="text-[11px] text-matos-muted">{msg}</p> : null}
    </div>
  );
}
