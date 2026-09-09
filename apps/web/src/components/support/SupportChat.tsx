"use client";

import { useState } from "react";

type Msg = {
  id: string;
  role: string;
  body: string;
};

export function SupportChat({
  initialThreadId,
  initialMessages,
}: {
  initialThreadId?: string | null;
  initialMessages?: Msg[];
}) {
  const [threadId, setThreadId] = useState<string | null>(initialThreadId ?? null);
  const [messages, setMessages] = useState<Msg[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setInput("");
    const optimistic: Msg = {
      id: `local-${Date.now()}`,
      role: "user",
      body: message,
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { id: `err-${Date.now()}`, role: "system", body: data.error ?? "Error" },
        ]);
        return;
      }
      setThreadId(data.threadId);
      setMessages((m) => [
        ...m.filter((x) => x.id !== optimistic.id),
        optimistic,
        {
          id: data.reply.id,
          role: "assistant",
          body: data.reply.body,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-2 overflow-auto p-[22px]">
        {messages.length === 0 ? (
          <div className="rounded-xl border border-matos-border bg-matos-panel p-4 text-xs text-matos-muted">
            Ask about getting started, channels, credits, or tickets. FAQ
            keyword matcher runs without an API key. Billing refunds escalate to
            a ticket.
          </div>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[720px] rounded-xl border px-3.5 py-2.5 text-xs whitespace-pre-wrap ${
              m.role === "user"
                ? "ml-auto border-matos-citron/30 bg-[rgba(214,243,31,0.1)]"
                : "border-matos-border bg-matos-panel"
            }`}
          >
            <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-matos-muted2">
              {m.role}
            </div>
            {m.body}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-matos-soft p-4">
        <input
          className="flex-1 rounded-lg border border-matos-border bg-matos-bg px-3 py-2 text-xs"
          placeholder="Ask support…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void send()}
          className="rounded-lg bg-matos-citron px-4 py-2 text-[11px] font-bold text-[#0b0c0e] disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
