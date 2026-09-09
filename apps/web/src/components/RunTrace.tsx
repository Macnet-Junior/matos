"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@matos/ui";
import type { ContentGate, WorkflowRunDTO } from "@/lib/types";
import { GATE_ORDER } from "@/lib/workflows-client";

const NEXT: Partial<Record<ContentGate, ContentGate>> = {
  draft: "warm",
  warm: "approved",
  approved: "scheduled",
  scheduled: "published",
};

function tone(
  status: string,
): "citron" | "muted" | "danger" {
  if (status === "completed" || status === "approved" || status === "published") {
    return "citron";
  }
  if (status === "blocked" || status === "failed") return "danger";
  return "muted";
}

export function RunTrace({
  run: initial,
  canApprove,
}: {
  run: WorkflowRunDTO;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [run, setRun] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextGate = NEXT[run.gateState];

  async function advance() {
    if (!nextGate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/runs/${run.id}/gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: nextGate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gate failed");
      setRun(data.run);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/workflows/${run.workflowId}`}
            className="text-[11px] text-matos-muted hover:text-matos-citron"
          >
            ← {run.workflowName ?? "Workflow"}
          </Link>
          <h1 className="mt-2 text-base font-semibold tracking-tight">
            Run trace
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-matos-muted">
            {run.summary}
          </p>
          <p className="mt-2 font-mono text-[11px] text-matos-muted2">
            {run.dryRun ? "dry-run" : "live"} · {run.id}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone(run.status)}>{run.status}</Badge>
          <Badge tone={tone(run.gateState)}>{run.gateState}</Badge>
          {canApprove && nextGate ? (
            <Button variant="primary" disabled={busy} onClick={advance}>
              Advance → {nextGate}
              {nextGate === "published" ? " (simulated)" : ""}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {GATE_ORDER.map((g) => (
          <span
            key={g}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              g === run.gateState
                ? "bg-matos-citron text-[#0b0c0e]"
                : GATE_ORDER.indexOf(g) < GATE_ORDER.indexOf(run.gateState)
                  ? "bg-[rgba(214,243,31,0.18)] text-matos-text"
                  : "bg-[#1c2030] text-matos-muted"
            }`}
          >
            {g}
          </span>
        ))}
      </div>

      {error ? (
        <div className="rounded-lg border border-[rgba(240,113,120,0.35)] bg-[rgba(240,113,120,0.08)] px-3 py-2 text-xs text-matos-danger">
          {error}
        </div>
      ) : null}

      <ol className="space-y-3">
        {run.steps.map((step) => (
          <li
            key={step.id}
            className="rounded-xl border border-matos-border bg-matos-panel p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="mr-2 text-[11px] text-matos-muted2">
                  Step {step.sortOrder + 1}
                </span>
                <span className="font-mono text-xs text-matos-citron">
                  {step.skillSlug}
                </span>
                <span className="ml-2 text-xs">{step.skillTitle}</span>
              </div>
              <div className="flex gap-1.5">
                <Badge tone={tone(step.status)}>{step.status}</Badge>
                <Badge tone="muted">{step.gateState}</Badge>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <h3 className="mb-1 text-[10px] uppercase tracking-[0.08em] text-matos-muted2">
                  Logs
                </h3>
                <pre className="max-h-40 overflow-auto rounded-lg border border-matos-soft bg-matos-elev p-2 font-mono text-[10px] text-matos-muted">
                  {JSON.stringify(step.logs, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="mb-1 text-[10px] uppercase tracking-[0.08em] text-matos-muted2">
                  Artifact
                </h3>
                <pre className="max-h-40 overflow-auto rounded-lg border border-matos-soft bg-matos-elev p-2 font-mono text-[10px] text-matos-muted">
                  {JSON.stringify(step.artifact, null, 2)}
                </pre>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section>
        <h2 className="mb-1 text-[10px] uppercase tracking-[0.08em] text-matos-muted2">
          Run artifact
        </h2>
        <pre className="max-h-56 overflow-auto rounded-xl border border-matos-border bg-matos-panel p-3 font-mono text-[10px] text-matos-muted">
          {JSON.stringify(run.artifact, null, 2)}
        </pre>
      </section>
    </div>
  );
}
