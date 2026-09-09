"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Attempt = {
  id: string;
  status: string;
  detail: string;
  actorEmail: string | null;
  createdAt: string;
};

type Rule = {
  id: string;
  name: string;
  triggerKeyword: string;
  channel: string;
  template: string;
  enabled: boolean;
  reviewGate: string;
  approvedBy: string | null;
  attempts: Attempt[];
};

export function AutoResponseDesk({
  initial,
  canManage,
}: {
  initial: Rule[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [rules, setRules] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    triggerKeyword: "",
    channel: "support",
    template: "",
  });

  async function act(action: string, ruleId?: string) {
    setError(null);
    const res = await fetch("/api/ops/auto-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "create" ? { action, ...form } : { action, ruleId },
      ),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    if (action === "create") {
      setForm({ name: "", triggerKeyword: "", channel: "support", template: "" });
    }
    const refresh = await fetch("/api/ops/auto-response");
    if (refresh.ok) {
      const json = await refresh.json();
      setRules(json.rules);
    }
    router.refresh();
  }

  return (
    <div className="space-y-4 p-[22px]">
      <div className="rounded-xl border border-matos-border bg-matos-panel p-4">
        <p className="text-xs text-matos-muted">
          Approved auto-reply rules only. Cannot enable without Owner/Operator +{" "}
          <strong className="text-matos-text">approved</strong> review gate. No
          spam growth bots.
        </p>
        {error ? (
          <p className="mt-2 text-xs text-matos-danger">{error}</p>
        ) : null}
      </div>

      {canManage ? (
        <div className="space-y-2 rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            New rule (starts pending)
          </h2>
          <div className="grid gap-2 md:grid-cols-2">
            <input
              className="rounded-lg border border-matos-border bg-matos-bg px-2 py-1.5 text-xs"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="rounded-lg border border-matos-border bg-matos-bg px-2 py-1.5 text-xs"
              placeholder="Trigger keyword"
              value={form.triggerKeyword}
              onChange={(e) =>
                setForm({ ...form, triggerKeyword: e.target.value })
              }
            />
            <select
              className="rounded-lg border border-matos-border bg-matos-bg px-2 py-1.5 text-xs"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              <option value="support">support</option>
              <option value="whatsapp">whatsapp</option>
              <option value="late">late</option>
              <option value="email">email</option>
            </select>
            <textarea
              className="md:col-span-2 rounded-lg border border-matos-border bg-matos-bg px-2 py-1.5 text-xs"
              rows={3}
              placeholder="Template"
              value={form.template}
              onChange={(e) => setForm({ ...form, template: e.target.value })}
            />
          </div>
          <button
            type="button"
            onClick={() => void act("create")}
            className="rounded-lg bg-matos-citron px-3 py-1.5 text-[11px] font-bold text-[#0b0c0e]"
          >
            Create rule
          </button>
        </div>
      ) : null}

      <div className="space-y-3">
        {rules.map((r) => (
          <article
            key={r.id}
            className="rounded-xl border border-matos-border bg-matos-panel p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold">{r.name}</h3>
                <p className="mt-1 font-mono text-[11px] text-matos-muted2">
                  trigger:{r.triggerKeyword} · {r.channel} · gate:{r.reviewGate}{" "}
                  · {r.enabled ? "enabled" : "disabled"}
                </p>
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-1.5">
                  {r.reviewGate !== "approved" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-matos-citron px-2 py-1 text-[10px] font-bold text-matos-citron"
                      onClick={() => void act("approve", r.id)}
                    >
                      Approve gate
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg bg-[#1c2030] px-2 py-1 text-[10px] font-semibold"
                    onClick={() =>
                      void act(r.enabled ? "disable" : "enable", r.id)
                    }
                  >
                    {r.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-[#1c2030] px-2 py-1 text-[10px] font-semibold"
                    onClick={() => void act("attempt", r.id)}
                  >
                    Sim attempt
                  </button>
                </div>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-matos-muted">{r.template}</p>
            {r.attempts.length ? (
              <ul className="mt-3 space-y-1 border-t border-matos-soft pt-2">
                {r.attempts.slice(0, 5).map((a) => (
                  <li key={a.id} className="text-[11px] text-matos-muted2">
                    {a.status} · {a.detail || "—"} ·{" "}
                    {new Date(a.createdAt).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                    })}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
