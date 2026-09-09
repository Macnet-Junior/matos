"use client";

import { useState } from "react";
import { Badge, Button } from "@matos/ui";
import type { Department, Skill } from "@/data/company-map";
import { getDepartment } from "@/data/company-map";

type Tab = "instructions" | "knowledge" | "evidence";

export type Selection =
  | { kind: "skill"; skill: Skill }
  | { kind: "department"; department: Department }
  | { kind: "company" }
  | null;

export function DetailPanel({
  selection,
}: {
  selection: Selection;
}) {
  const [tab, setTab] = useState<Tab>("knowledge");
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
            <b>0 · Scaffold</b>
          </div>
        </div>
      </section>
    );
  }

  if (selection.kind === "department") {
    const d = selection.department;
    return (
      <section className="flex h-full w-[320px] shrink-0 flex-col gap-3.5 border-l border-matos-soft bg-matos-elev px-4 py-[18px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base tracking-tight">{d.name}</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-matos-muted">
              {d.summary}
            </p>
          </div>
          <Badge tone="muted">{d.skillIds.length} skills</Badge>
        </div>
        <p className="text-xs text-matos-muted">
          Expand on the map to reveal authored skills for this department.
        </p>
      </section>
    );
  }

  const skill = selection.skill;
  const dept = getDepartment(skill.departmentId);

  function runSkill() {
    setToast(`Queued ${skill.slug} (no-op in Phase 0)`);
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
        <Badge>Authored</Badge>
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
          <p className="text-xs leading-relaxed text-matos-muted">
            {skill.instructions}
          </p>
        )}
        {tab === "knowledge" &&
          skill.knowledge.map((path) => (
            <div
              key={path}
              className="rounded-lg border border-matos-soft bg-matos-panel px-2.5 py-2 font-mono text-[11px] text-matos-muted"
            >
              {path}
            </div>
          ))}
        {tab === "evidence" &&
          skill.evidence.map((line) => (
            <p key={line} className="text-xs text-matos-muted">
              {line}
            </p>
          ))}
      </div>

      {toast && (
        <div className="rounded-lg border border-matos-border bg-matos-panel px-3 py-2 text-xs text-matos-citron">
          {toast}
        </div>
      )}

      <Button variant="primary" className="mt-auto w-full py-2.5" onClick={runSkill}>
        Run skill
      </Button>
    </section>
  );
}
