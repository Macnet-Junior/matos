"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@matos/ui";
import type { ContentGate, SkillDTO, WorkflowDTO } from "@/lib/types";

function gateTone(gate: ContentGate): "citron" | "muted" | "danger" {
  if (gate === "approved" || gate === "published" || gate === "scheduled") {
    return "citron";
  }
  if (gate === "warm") return "muted";
  return "muted";
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function WorkflowsPanel({
  workflows: initial,
  skills,
  isOwner,
}: {
  workflows: WorkflowDTO[];
  skills: SkillDTO[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState(initial);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const skillOptions = useMemo(
    () =>
      skills
        .slice()
        .sort((a, b) => a.slug.localeCompare(b.slug)),
    [skills],
  );

  function toggleSkill(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 20) return prev;
      return [...prev, id];
    });
  }

  function moveSelected(id: string, dir: -1 | 1) {
    setSelected((prev) => {
      const i = prev.indexOf(id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
  }

  async function createWorkflow() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slug || slugify(name),
          description,
          skillIds: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Create failed");
      }
      setWorkflows((prev) =>
        [...prev, data.workflow as WorkflowDTO].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setOpen(false);
      setName("");
      setSlug("");
      setDescription("");
      setSelected([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function runWorkflow(id: string) {
    setRunningId(id);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      router.push(`/workflows/runs/${data.run.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-matos-muted">
          Ordered skill chains with review gates. Dry-run only — no external
          posts.
        </p>
        {isOwner ? (
          <Button variant="primary" onClick={() => setOpen(true)}>
            New workflow
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-[rgba(240,113,120,0.35)] bg-[rgba(240,113,120,0.08)] px-3 py-2 text-xs text-matos-danger">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3">
        {workflows.length === 0 ? (
          <div className="rounded-xl border border-matos-border bg-matos-panel p-4 text-xs text-matos-muted">
            No workflows yet. Create a skill chain to get started.
          </div>
        ) : (
          workflows.map((wf) => (
            <article
              key={wf.id}
              className="rounded-xl border border-matos-border bg-matos-panel p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/workflows/${wf.id}`}
                    className="text-sm font-semibold tracking-tight hover:text-matos-citron"
                  >
                    {wf.name}
                  </Link>
                  <p className="mt-1 font-mono text-[11px] text-matos-muted2">
                    {wf.slug}
                  </p>
                  <p className="mt-2 max-w-2xl text-xs text-matos-muted">
                    {wf.description || "No description"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={gateTone(wf.gateState)}>{wf.gateState}</Badge>
                  <Badge tone="muted">{wf.steps.length} steps</Badge>
                  {typeof wf.runCount === "number" ? (
                    <Badge tone="muted">{wf.runCount} runs</Badge>
                  ) : null}
                </div>
              </div>
              <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                {wf.steps.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-1.5">
                    {i > 0 ? (
                      <span className="text-matos-muted2">→</span>
                    ) : null}
                    <span className="rounded-md border border-matos-soft bg-matos-elev px-2 py-0.5 font-mono text-matos-citron">
                      {s.skillSlug}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/workflows/${wf.id}`}
                  className="inline-flex items-center justify-center rounded-lg border border-matos-border bg-matos-panel px-3 py-2 text-xs text-matos-text hover:border-matos-citron"
                >
                  Open
                </Link>
                {isOwner ? (
                  <Button
                    variant="primary"
                    disabled={runningId === wf.id}
                    onClick={() => runWorkflow(wf.id)}
                  >
                    {runningId === wf.id ? "Running…" : "Dry-run"}
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl border border-matos-border bg-matos-elev p-5 shadow-2xl">
            <h2 className="text-sm font-semibold tracking-tight">
              Create workflow
            </h2>
            <p className="mt-1 text-[11px] text-matos-muted">
              Pick skills in order. Gate starts at draft.
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-[11px] text-matos-muted2">
                Name
                <input
                  className="mt-1 w-full rounded-lg border border-matos-border bg-matos-panel px-3 py-2 text-xs text-matos-text outline-none focus:border-matos-citron"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug || slug === slugify(name)) {
                      setSlug(slugify(e.target.value));
                    }
                  }}
                />
              </label>
              <label className="block text-[11px] text-matos-muted2">
                Slug
                <input
                  className="mt-1 w-full rounded-lg border border-matos-border bg-matos-panel px-3 py-2 font-mono text-xs text-matos-text outline-none focus:border-matos-citron"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </label>
              <label className="block text-[11px] text-matos-muted2">
                Description
                <textarea
                  className="mt-1 w-full rounded-lg border border-matos-border bg-matos-panel px-3 py-2 text-xs text-matos-text outline-none focus:border-matos-citron"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div>
                <div className="mb-1.5 text-[11px] text-matos-muted2">
                  Skill chain ({selected.length} selected)
                </div>
                {selected.length > 0 ? (
                  <ol className="mb-2 space-y-1 rounded-lg border border-matos-soft bg-matos-panel p-2">
                    {selected.map((id, i) => {
                      const skill = skillOptions.find((s) => s.id === id);
                      return (
                        <li
                          key={id}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="font-mono text-matos-citron">
                            {i + 1}. {skill?.slug ?? id}
                          </span>
                          <span className="flex gap-1">
                            <button
                              type="button"
                              className="rounded px-1.5 text-matos-muted hover:text-matos-text"
                              onClick={() => moveSelected(id, -1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="rounded px-1.5 text-matos-muted hover:text-matos-text"
                              onClick={() => moveSelected(id, 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="rounded px-1.5 text-matos-danger"
                              onClick={() => toggleSkill(id)}
                            >
                              ×
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
                <div className="max-h-48 space-y-1 overflow-auto rounded-lg border border-matos-border p-2">
                  {skillOptions.map((s) => {
                    const on = selected.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSkill(s.id)}
                        className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] ${
                          on
                            ? "bg-[rgba(214,243,31,0.12)] text-matos-text"
                            : "text-matos-muted hover:bg-[#1a1d27]"
                        }`}
                      >
                        <span>
                          <span className="font-mono text-matos-citron">
                            {s.slug}
                          </span>
                          <span className="ml-2">{s.title}</span>
                        </span>
                        <Badge tone={on ? "citron" : "muted"}>
                          {on ? "in chain" : s.status}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={
                  busy || !name.trim() || selected.length === 0
                }
                onClick={createWorkflow}
              >
                {busy ? "Saving…" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
