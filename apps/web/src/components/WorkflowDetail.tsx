"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@matos/ui";
import type {
  ContentGate,
  SkillDTO,
  WorkflowDTO,
  WorkflowRunSummaryDTO,
} from "@/lib/types";
import { GATE_ORDER } from "@/lib/workflows-client";

function gateTone(gate: ContentGate): "citron" | "muted" | "danger" {
  if (gate === "approved" || gate === "published" || gate === "scheduled") {
    return "citron";
  }
  return "muted";
}

const NEXT: Partial<Record<ContentGate, ContentGate>> = {
  draft: "warm",
  warm: "approved",
  approved: "scheduled",
  scheduled: "published",
};

export function WorkflowDetail({
  workflow: initial,
  runs: initialRuns,
  skills,
  canManageWorkflows,
  canRunWorkflows,
  canApprove,
}: {
  workflow: WorkflowDTO;
  runs: WorkflowRunSummaryDTO[];
  skills: SkillDTO[];
  canManageWorkflows: boolean;
  canRunWorkflows: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState(initial);
  const [runs] = useState(initialRuns);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [selected, setSelected] = useState(
    initial.steps.map((s) => s.skillId),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const skillOptions = useMemo(
    () => skills.slice().sort((a, b) => a.slug.localeCompare(b.slug)),
    [skills],
  );

  const nextGate = NEXT[workflow.gateState];

  async function saveEdit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          skillIds: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      setWorkflow(data.workflow);
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function dryRun() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/run`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      router.push(`/workflows/runs/${data.run.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
      setBusy(false);
    }
  }

  async function advanceGate() {
    if (!nextGate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${workflow.id}/gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: nextGate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gate failed");
      setWorkflow(data.workflow);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gate failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleSkill(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function move(id: string, dir: -1 | 1) {
    setSelected((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/workflows"
            className="text-[11px] text-matos-muted hover:text-matos-citron"
          >
            ← Workflows
          </Link>
          <h1 className="mt-2 text-base font-semibold tracking-tight">
            {workflow.name}
          </h1>
          <p className="mt-1 font-mono text-[11px] text-matos-muted2">
            {workflow.slug}
          </p>
          <p className="mt-2 max-w-2xl text-xs text-matos-muted">
            {workflow.description || "No description"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={gateTone(workflow.gateState)}>
            {workflow.gateState}
          </Badge>
          {canManageWorkflows ? (
            <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
              {editing ? "Close editor" : "Edit chain"}
            </Button>
          ) : null}
          {canRunWorkflows ? (
            <Button variant="primary" disabled={busy} onClick={dryRun}>
              Dry-run
            </Button>
          ) : null}
          {canApprove && nextGate ? (
            <Button
              variant="secondary"
              disabled={busy}
              onClick={advanceGate}
            >
              Advance → {nextGate}
              {nextGate === "published" ? " (sim)" : ""}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {GATE_ORDER.map((g) => (
          <span
            key={g}
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              g === workflow.gateState
                ? "bg-matos-citron text-[#0b0c0e]"
                : gateIndexPassed(workflow.gateState, g)
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

      {editing ? (
        <div className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <label className="block text-[11px] text-matos-muted2">
            Name
            <input
              className="mt-1 w-full rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-xs outline-none focus:border-matos-citron"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="mt-3 block text-[11px] text-matos-muted2">
            Description
            <textarea
              className="mt-1 w-full rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-xs outline-none focus:border-matos-citron"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="mt-3">
            <div className="mb-1 text-[11px] text-matos-muted2">
              Ordered skills
            </div>
            <ol className="mb-2 space-y-1">
              {selected.map((id, i) => {
                const s = skillOptions.find((x) => x.id === id);
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between rounded-md border border-matos-soft bg-matos-elev px-2 py-1 text-[11px]"
                  >
                    <span className="font-mono text-matos-citron">
                      {i + 1}. {s?.slug ?? id}
                    </span>
                    <span className="flex gap-1">
                      <button type="button" onClick={() => move(id, -1)}>
                        ↑
                      </button>
                      <button type="button" onClick={() => move(id, 1)}>
                        ↓
                      </button>
                      <button type="button" onClick={() => toggleSkill(id)}>
                        ×
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-matos-border p-2">
              {skillOptions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="flex w-full justify-between rounded px-2 py-1 text-left text-[11px] text-matos-muted hover:bg-[#1a1d27]"
                  onClick={() => toggleSkill(s.id)}
                >
                  <span className="font-mono text-matos-citron">{s.slug}</span>
                  <span>{selected.includes(s.id) ? "selected" : "add"}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              variant="primary"
              disabled={busy || selected.length === 0}
              onClick={saveEdit}
            >
              Save
            </Button>
          </div>
        </div>
      ) : (
        <ol className="space-y-2">
          {workflow.steps.map((s, i) => (
            <li
              key={s.id}
              className="rounded-xl border border-matos-border bg-matos-panel px-3.5 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="mr-2 text-[11px] text-matos-muted2">
                    {i + 1}.
                  </span>
                  <span className="font-mono text-xs text-matos-citron">
                    {s.skillSlug}
                  </span>
                  <span className="ml-2 text-xs">{s.label ?? s.skillTitle}</span>
                </div>
                <div className="flex gap-1.5">
                  <Badge tone="muted">{s.skillStatus}</Badge>
                  <Badge tone="muted">req {s.skillReviewGate}</Badge>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <section>
        <h2 className="mb-2 text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
          Recent runs
        </h2>
        {runs.length === 0 ? (
          <div className="rounded-xl border border-matos-border bg-matos-panel p-4 text-xs text-matos-muted">
            No runs yet. Owner can dry-run this workflow.
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => (
              <Link
                key={r.id}
                href={`/workflows/runs/${r.id}`}
                className="block rounded-xl border border-matos-border bg-matos-panel px-3.5 py-3 hover:border-matos-citron"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold">{r.summary}</p>
                    <p className="mt-1 font-mono text-[11px] text-matos-muted2">
                      {r.status} · {r.gateState}
                      {r.dryRun ? " · dry-run" : ""}
                    </p>
                  </div>
                  <time className="text-[11px] text-matos-muted2">
                    {new Date(r.startedAt).toLocaleString("en-US", {
                      timeZone: "America/New_York",
                    })}
                  </time>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function gateIndexPassed(current: ContentGate, candidate: ContentGate) {
  return GATE_ORDER.indexOf(candidate) < GATE_ORDER.indexOf(current);
}
