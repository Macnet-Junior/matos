"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { knowledgeHref } from "@/lib/app-links";

type Ticket = {
  id: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  requesterEmail: string;
  assigneeEmail: string | null;
  createdAt: string;
  messages: { id: string; authorEmail: string; body: string; createdAt: string }[];
};

export function SupportCenter({
  initial,
  canOps,
  faqs,
}: {
  initial: Ticket[];
  canOps: boolean;
  faqs: { path: string; title: string }[];
}) {
  const router = useRouter();
  const [tickets, setTickets] = useState(initial);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("normal");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/support/tickets");
    if (res.ok) {
      const data = await res.json();
      setTickets(data.tickets);
    }
  }

  async function create() {
    setError(null);
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, priority }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setSubject("");
    setBody("");
    await refresh();
    router.refresh();
  }

  async function setStatus(ticketId: string, status: string) {
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", ticketId, status }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Update failed");
      return;
    }
    await refresh();
    router.refresh();
  }

  return (
    <div className="grid flex-1 gap-4 overflow-auto p-[22px] lg:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        <div className="space-y-2 rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            New ticket
          </h2>
          {error ? <p className="text-xs text-matos-danger">{error}</p> : null}
          <input
            className="w-full rounded-lg border border-matos-border bg-matos-bg px-2 py-1.5 text-xs"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="w-full rounded-lg border border-matos-border bg-matos-bg px-2 py-1.5 text-xs"
            rows={4}
            placeholder="Describe the issue"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-matos-border bg-matos-bg px-2 py-1.5 text-xs"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">low</option>
              <option value="normal">normal</option>
              <option value="high">high</option>
            </select>
            <button
              type="button"
              onClick={() => void create()}
              className="rounded-lg bg-matos-citron px-3 py-1.5 text-[11px] font-bold text-[#0b0c0e]"
            >
              Create ticket
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {tickets.map((t) => (
            <article
              key={t.id}
              className="rounded-xl border border-matos-border bg-matos-panel p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">{t.subject}</h3>
                  <p className="mt-1 font-mono text-[11px] text-matos-muted2">
                    {t.status} · {t.priority} · {t.requesterEmail}
                    {t.assigneeEmail ? ` → ${t.assigneeEmail}` : ""}
                  </p>
                </div>
                {canOps ? (
                  <div className="flex gap-1">
                    {["open", "pending", "solved"].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void setStatus(t.id, s)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          t.status === s
                            ? "bg-matos-citron text-[#0b0c0e]"
                            : "bg-[#1c2030] text-matos-muted"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-matos-muted">{t.body}</p>
            </article>
          ))}
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Knowledge FAQs
          </h2>
          <ul className="mt-2 space-y-1.5">
            {faqs.map((f) => (
              <li key={f.path} className="text-xs text-matos-muted">
                <Link
                  href={knowledgeHref(f.path)}
                  className="text-matos-text hover:text-matos-citron"
                >
                  {f.title}
                </Link>
                <span className="mt-0.5 block font-mono text-[10px] text-matos-muted2">
                  {f.path}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <a
          href="/support/chat"
          className="block rounded-xl border border-matos-citron/40 bg-[rgba(214,243,31,0.08)] p-4 text-xs font-semibold text-matos-citron hover:bg-[rgba(214,243,31,0.14)]"
        >
          Open support chatbot →
        </a>
      </aside>
    </div>
  );
}
