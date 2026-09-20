"use client";

import { useEffect, useState } from "react";
import { Badge, Button } from "@matos/ui";
import type {
  DepartmentDTO,
  EvidenceLinkDTO,
  MapCapabilities,
  MapPayload,
  SkillDTO,
  SkillStatus,
} from "@/lib/types";
import { isKnowledgePath, knowledgeHref } from "@/lib/app-links";
import { MarkdownView } from "./MarkdownView";

type Tab = "instructions" | "knowledge" | "evidence";

export type Selection =
  | { kind: "skill"; skill: SkillDTO }
  | { kind: "department"; department: DepartmentDTO }
  | { kind: "company" }
  | null;

function statusTone(status: SkillStatus): "citron" | "muted" | "danger" {
  if (status === "authored") return "citron";
  if (status === "missing") return "danger";
  return "muted";
}

function statusLabel(status: SkillStatus): string {
  if (status === "authored") return "Authored";
  if (status === "missing") return "Missing sources";
  return "Planned";
}

function KnowledgeTab({
  paths,
}: {
  paths: { id: string; path: string; title: string | null }[];
}) {
  const [active, setActive] = useState<string | null>(paths[0]?.path ?? null);
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setActive(paths[0]?.path ?? null);
  }, [paths]);

  useEffect(() => {
    if (!active) {
      setContent("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/knowledge?path=${encodeURIComponent(active)}`)
      .then(async (res) => {
        const data = (await res.json()) as { content?: string; error?: string };
        if (!res.ok) throw new Error(data.error ?? "Failed to load");
        if (!cancelled) setContent(data.content ?? "");
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setContent("");
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!paths.length) {
    return <p className="text-xs text-matos-muted2">No knowledge links.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {paths.map((k) => (
        <button
          key={k.id}
          type="button"
          onClick={() => setActive(k.path)}
          className={`rounded-lg border px-2.5 py-2 text-left font-mono text-[11px] transition-colors ${
            active === k.path
              ? "border-matos-citron bg-matos-panel text-matos-text"
              : "border-matos-soft bg-matos-panel text-matos-muted"
          }`}
        >
          {k.title ? (
            <div className="mb-1 font-sans text-[11px] text-matos-text">
              {k.title}
            </div>
          ) : null}
          {k.path}
        </button>
      ))}
      <div className="min-h-[120px] rounded-lg border border-matos-soft bg-matos-bg p-2.5">
        {loading ? (
          <p className="text-[11px] text-matos-muted">Loading…</p>
        ) : error ? (
          <p className="text-[11px] text-matos-danger">{error}</p>
        ) : (
          <MarkdownView content={content} />
        )}
      </div>
    </div>
  );
}

function EvidenceTab({
  skill,
  capabilities,
  onMapUpdate,
}: {
  skill: SkillDTO;
  capabilities: MapCapabilities;
  onMapUpdate?: (map: MapPayload, skill: SkillDTO) => void;
}) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: EvidenceLinkDTO[]) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence: next }),
      });
      const data = (await res.json()) as {
        error?: string;
        map?: MapPayload;
        skill?: SkillDTO;
      };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      if (data.map && data.skill && onMapUpdate) {
        onMapUpdate(data.map, data.skill);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    const nextLabel = label.trim();
    const nextUrl = url.trim();
    if (!nextLabel || !nextUrl) {
      setError("Label and URL required");
      return;
    }
    await persist([...skill.evidence, { label: nextLabel, url: nextUrl }]);
    setLabel("");
    setUrl("");
  }

  async function removeAt(index: number) {
    const next = skill.evidence.filter((_, i) => i !== index);
    await persist(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {skill.evidence.length === 0 ? (
        <p className="text-xs text-matos-muted2">No evidence links yet.</p>
      ) : (
        skill.evidence.map((item, index) => (
          <div
            key={`${item.url}-${index}`}
            className="flex items-start justify-between gap-2 rounded-lg border border-matos-soft bg-matos-panel px-2.5 py-2"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-matos-text">
                {item.label}
              </div>
              <a
                href={
                  isKnowledgePath(item.url)
                    ? knowledgeHref(item.url)
                    : item.url
                }
                className="mt-0.5 block truncate font-mono text-[10px] text-matos-citron"
                target={item.url.startsWith("http") ? "_blank" : undefined}
                rel={item.url.startsWith("http") ? "noreferrer" : undefined}
                title={item.url}
              >
                {item.url}
              </a>
            </div>
            {capabilities.canEditSkills && (
              <button
                type="button"
                disabled={busy}
                onClick={() => removeAt(index)}
                className="shrink-0 text-[10px] text-matos-muted hover:text-matos-danger"
              >
                Remove
              </button>
            )}
          </div>
        ))
      )}

      {capabilities.canEditSkills && (
        <form
          onSubmit={addLink}
          className="mt-1 grid gap-2 rounded-lg border border-matos-soft bg-matos-bg p-2.5"
        >
          <div className="text-[10px] uppercase tracking-wide text-matos-muted2">
            Add evidence link
          </div>
          <input
            className="rounded-lg border border-matos-border bg-matos-panel px-2 py-1.5 text-xs"
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            disabled={busy}
          />
          <input
            className="rounded-lg border border-matos-border bg-matos-panel px-2 py-1.5 font-mono text-[11px]"
            placeholder="https://… or knowledge/…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
          />
          <Button type="submit" variant="secondary" disabled={busy}>
            {busy ? "Saving…" : "Add link"}
          </Button>
        </form>
      )}

      {error && (
        <p className="text-[11px] text-matos-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function DetailPanel({
  selection,
  departments,
  capabilities,
  onEditSkill,
  onEditDepartment,
  onMapUpdate,
}: {
  selection: Selection;
  departments: DepartmentDTO[];
  capabilities: MapCapabilities;
  onEditSkill?: (skill: SkillDTO) => void;
  onEditDepartment?: (department: DepartmentDTO) => void;
  onMapUpdate?: (map: MapPayload, skill: SkillDTO) => void;
}) {
  const [tab, setTab] = useState<Tab>("instructions");
  const [toast, setToast] = useState<string | null>(null);

  if (!selection) {
    return (
      <section className="flex h-full w-[320px] shrink-0 flex-col gap-3.5 border-l border-matos-soft bg-matos-elev px-4 py-[18px]">
        <h2 className="text-base tracking-tight">Selection</h2>
        <p className="text-xs leading-relaxed text-matos-muted">
          Select a department or skill on the company map to inspect
          instructions, knowledge, and evidence.
        </p>
      </section>
    );
  }

  if (selection.kind === "company") {
    return (
      <section className="flex h-full w-[320px] shrink-0 flex-col gap-3.5 border-l border-matos-soft bg-matos-elev px-4 py-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base tracking-tight">MatOS Agency</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-matos-muted">
              Root operating entity for the agency map.
            </p>
          </div>
          <Badge>LIVE</Badge>
        </div>
        <div className="grid gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-matos-muted2">Owner</span>
            <b>Macnet Junior</b>
          </div>
          <div className="flex justify-between">
            <span className="text-matos-muted2">Phase</span>
            <b>2 · Knowledge</b>
          </div>
          <div className="flex justify-between">
            <span className="text-matos-muted2">Departments</span>
            <b>{departments.length}</b>
          </div>
        </div>
      </section>
    );
  }

  if (selection.kind === "department") {
    const d = selection.department;
    const authored = d.skills.filter((s) => s.status === "authored").length;
    return (
      <section className="flex h-full w-[320px] shrink-0 flex-col gap-3.5 border-l border-matos-soft bg-matos-elev px-4 py-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base tracking-tight">{d.name}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-matos-muted">
              {d.summary}
            </p>
          </div>
          <Badge tone="muted">{d.skills.length} skills</Badge>
        </div>
        <div className="grid gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-matos-muted2">Authored</span>
            <b className="text-matos-citron">{authored}</b>
          </div>
          <div className="flex justify-between">
            <span className="text-matos-muted2">Slug</span>
            <b className="font-mono">{d.slug}</b>
          </div>
        </div>
        <p className="text-xs text-matos-muted">
          Click the node again to expand or collapse skill nodes on the map.
        </p>
        {capabilities.canManageMap && onEditDepartment && (
          <Button
            variant="secondary"
            className="mt-auto w-full"
            onClick={() => onEditDepartment(d)}
          >
            Edit department
          </Button>
        )}
      </section>
    );
  }

  const skill = selection.skill;
  const dept = departments.find((d) => d.id === skill.departmentId);

  function runSkill() {
    setToast(`Queued ${skill.slug} (no-op until workflows)`);
    window.setTimeout(() => setToast(null), 2200);
  }

  return (
    <section className="flex h-full w-[320px] shrink-0 flex-col gap-3.5 border-l border-matos-soft bg-matos-elev px-4 py-[18px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base tracking-tight">{skill.title}</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-matos-muted">
            {skill.description}
          </p>
        </div>
        <Badge tone={statusTone(skill.status)}>
          {statusLabel(skill.status)}
        </Badge>
      </div>

      <div className="grid gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-matos-muted2">Department</span>
          <b>{dept?.name ?? "—"}</b>
        </div>
        <div className="flex justify-between">
          <span className="text-matos-muted2">Owner</span>
          <b>{skill.owner}</b>
        </div>
        <div className="flex justify-between">
          <span className="text-matos-muted2">Review gate</span>
          <b className="text-matos-citron">{skill.reviewGate}</b>
        </div>
      </div>

      {skill.purpose ? (
        <p className="rounded-lg border border-matos-soft bg-matos-panel px-2.5 py-2 text-xs leading-relaxed text-matos-muted">
          {skill.purpose}
        </p>
      ) : null}

      <div className="flex gap-1 border-b border-matos-soft">
        {(
          [
            ["instructions", "Instructions"],
            ["knowledge", "Knowledge"],
            ["evidence", "Evidence"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-2.5 py-2 text-xs transition-colors ${
              tab === id
                ? "text-matos-text shadow-[inset_0_-2px_0_#D6F31F]"
                : "text-matos-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
        {tab === "instructions" && (
          <>
            {skill.instructions ? (
              <MarkdownView content={skill.instructions} />
            ) : (
              <p className="text-xs text-matos-muted2">No instructions yet.</p>
            )}
            {skill.steps.length > 0 && (
              <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs text-matos-muted">
                {skill.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            )}
          </>
        )}
        {tab === "knowledge" && <KnowledgeTab paths={skill.knowledge} />}
        {tab === "evidence" && (
          <EvidenceTab
            skill={skill}
            capabilities={capabilities}
            onMapUpdate={onMapUpdate}
          />
        )}
      </div>

      {toast && (
        <div className="rounded-lg border border-matos-border bg-matos-panel px-3 py-2 text-xs text-matos-citron">
          {toast}
        </div>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {capabilities.canEditSkills && onEditSkill && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => onEditSkill(skill)}
          >
            Edit skill
          </Button>
        )}
        <Button variant="primary" className="w-full py-2.5" onClick={runSkill}>
          Run skill
        </Button>
      </div>
    </section>
  );
}
