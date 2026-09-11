"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@matos/ui";
import type { DeskInboxItemDTO } from "@/lib/desk";

export function DeskInbox({
  items: initial,
  canApprove,
}: {
  items: DeskInboxItemDTO[];
  canApprove: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "copied") {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/desk/inbox/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      setItems((prev) => prev.map((i) => (i.id === id ? data.item : i)));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-auto p-[22px]">
      <p className="max-w-xl text-xs text-matos-muted">
        Echo drafts only. Mark <span className="text-matos-text">approved</span>{" "}
        or <span className="text-matos-text">copied</span> — there is no live
        network send in this phase.
      </p>
      {error ? <p className="text-xs text-matos-danger">{error}</p> : null}
      {items.length === 0 ? (
        <div className="rounded-xl border border-matos-border bg-matos-panel p-6 text-sm text-matos-muted">
          Inbox empty. Approve Echo on a Desk job to draft replies here.
        </div>
      ) : (
        items.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-matos-border bg-matos-panel p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">
                  {item.subject}
                </h2>
                <p className="mt-1 text-[11px] text-matos-muted">
                  {item.channel}
                  {item.jobTitle ? ` · ${item.jobTitle}` : ""}
                </p>
              </div>
              <Badge
                tone={
                  item.status === "drafted"
                    ? "muted"
                    : item.status === "approved"
                      ? "citron"
                      : "muted"
                }
              >
                {item.status}
              </Badge>
            </div>
            <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-matos-soft bg-matos-elev p-3 font-mono text-[12px] leading-relaxed text-matos-text">
              {item.body}
            </pre>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canApprove ? (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    disabled={busyId === item.id || item.status === "approved"}
                    onClick={() => act(item.id, "approve")}
                  >
                    Mark approved
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busyId === item.id}
                    onClick={() => act(item.id, "copied")}
                  >
                    Mark copied
                  </Button>
                </>
              ) : null}
              <Link
                href={`/desk/${item.jobId}`}
                className="text-[11px] text-matos-citron"
              >
                Open job →
              </Link>
              <span className="text-[10px] text-matos-muted2">
                Send blocked by design
              </span>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
