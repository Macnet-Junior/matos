"use client";

import { useMemo, useState } from "react";
import { Badge, Button } from "@matos/ui";
import type { ChannelDTO, ChannelStatus } from "@/lib/types";

function statusTone(status: ChannelStatus): "citron" | "muted" | "danger" {
  if (status === "connected") return "citron";
  if (status === "error") return "danger";
  return "muted";
}

function statusLabel(status: ChannelStatus): string {
  if (status === "connected") return "Connected";
  if (status === "error") return "Error";
  return "Disconnected";
}

const COVERAGE_COLS = ["API", "Scheduled", "Handoff", "Disconnected"] as const;

export function ChannelsPanel({
  initialChannels,
  canManage,
}: {
  initialChannels: ChannelDTO[];
  canManage: boolean;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [lateKey, setLateKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const matrix = useMemo(() => channels, [channels]);

  async function refresh() {
    const res = await fetch("/api/channels");
    if (!res.ok) return;
    const data = (await res.json()) as { channels: ChannelDTO[] };
    setChannels(data.channels);
  }

  async function connectLate() {
    setBusy("late-dev");
    setMessage(null);
    try {
      const res = await fetch("/api/channels/late-dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", apiKey: lateKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Connect failed");
      setLateKey("");
      setMessage(`Late.dev: ${data.channel?.status ?? "saved"} (key never shown again)`);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: string) {
    setBusy(provider);
    setMessage(null);
    try {
      const res = await fetch(`/api/channels/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Disconnect failed");
      setMessage(`Disconnected ${provider}`);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setBusy(null);
    }
  }

  async function connectWhatsAppEnv() {
    setBusy("whatsapp");
    setMessage(null);
    try {
      const res = await fetch("/api/channels/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Connect failed");
      setMessage("WhatsApp: connected from env (allowlisted destination only)");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Connect failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-lg border border-matos-soft bg-matos-elev px-3 py-2 text-[11px] text-matos-muted">
          {message}
        </p>
      ) : null}

      <section className="rounded-xl border border-matos-border bg-matos-panel p-4">
        <h2 className="text-sm font-semibold tracking-tight">Coverage matrix</h2>
        <p className="mt-1 text-[11px] text-matos-muted">
          API · Scheduled · Handoff · Disconnected — live status from adapters.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="border-b border-matos-soft text-matos-muted2">
                <th className="py-2 pr-3 font-medium">Platform</th>
                {COVERAGE_COLS.map((c) => (
                  <th key={c} className="py-2 px-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((ch) => (
                <tr key={ch.id} className="border-b border-matos-soft/60">
                  <td className="py-2 pr-3 font-medium text-matos-text">
                    {ch.name}
                  </td>
                  <td className="py-2 px-2 text-matos-muted">{ch.coverage.api}</td>
                  <td className="py-2 px-2 text-matos-muted">
                    {ch.coverage.scheduled}
                  </td>
                  <td className="py-2 px-2 text-matos-muted">
                    {ch.coverage.handoff}
                  </td>
                  <td className="py-2 px-2 text-matos-muted">
                    {ch.coverage.disconnected}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="space-y-3">
        {channels.map((ch) => (
          <article
            key={ch.id}
            className="rounded-xl border border-matos-border bg-matos-panel p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold tracking-tight">
                  {ch.name}
                </h2>
                <p className="mt-2 max-w-2xl text-xs text-matos-muted">
                  {ch.note}
                </p>
                {ch.maskedHint ? (
                  <p className="mt-2 text-[11px] text-matos-muted2">
                    Credential: {ch.maskedHint}
                  </p>
                ) : null}
                {ch.lastError ? (
                  <p className="mt-2 text-[11px] text-matos-danger">
                    {ch.lastError}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone={statusTone(ch.status)}>
                  {statusLabel(ch.status)}
                </Badge>
                <span className="rounded-lg border border-matos-border px-3 py-1.5 text-[11px] text-matos-muted2">
                  {ch.phase}
                </span>
              </div>
            </div>

            {ch.id === "late-dev" && canManage ? (
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[11px] text-matos-muted">
                  Late / Zernio API key
                  <input
                    type="password"
                    autoComplete="off"
                    value={lateKey}
                    onChange={(e) => setLateKey(e.target.value)}
                    placeholder="sk_…"
                    className="rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-xs text-matos-text outline-none focus:border-matos-citron"
                  />
                </label>
                <Button
                  type="button"
                  disabled={busy === "late-dev" || !lateKey.trim()}
                  onClick={() => void connectLate()}
                >
                  {busy === "late-dev" ? "Saving…" : "Connect"}
                </Button>
                {ch.status !== "disconnected" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy === "late-dev"}
                    onClick={() => void disconnect("late-dev")}
                  >
                    Disconnect
                  </Button>
                ) : null}
              </div>
            ) : null}

            {ch.id === "etsy" && canManage ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href="/api/integrations/etsy/oauth/start"
                  className="inline-flex items-center rounded-lg bg-matos-citron px-3 py-2 text-[11px] font-bold text-[#0b0c0e] hover:bg-[#E8FF5A]"
                >
                  Connect with Etsy OAuth
                </a>
                {ch.status !== "disconnected" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy === "etsy"}
                    onClick={() => void disconnect("etsy")}
                  >
                    Disconnect
                  </Button>
                ) : null}
                {!ch.meta?.envKeyConfigured ? (
                  <span className="text-[11px] text-matos-muted2">
                    Set ETSY_API_KEY (+ ETSY_REDIRECT_URI) in .env.local first
                  </span>
                ) : null}
              </div>
            ) : null}

            {ch.id === "whatsapp" ? (
              <div className="mt-3 space-y-2">
                <p className="rounded-lg border border-matos-soft bg-matos-elev px-3 py-2 text-[11px] text-matos-muted">
                  Allowed destination only:{" "}
                  <strong className="text-matos-text">
                    {ch.allowedDestination?.label}
                  </strong>
                  {ch.allowedDestination?.id ? (
                    <>
                      {" "}
                      · id <code className="text-matos-citron">{ch.allowedDestination.id}</code>
                    </>
                  ) : (
                    <> · set <code>WHATSAPP_GROUP_OR_TO</code></>
                  )}
                </p>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={busy === "whatsapp"}
                      onClick={() => void connectWhatsAppEnv()}
                    >
                      {busy === "whatsapp" ? "Connecting…" : "Connect from env"}
                    </Button>
                    {ch.status !== "disconnected" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy === "whatsapp"}
                        onClick={() => void disconnect("whatsapp")}
                      >
                        Disconnect
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
