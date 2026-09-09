"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@matos/ui";
import type { DepartmentDTO, MapPayload, SkillDTO } from "@/lib/types";
import { CompanyMap } from "./CompanyMap";
import { DetailPanel, type Selection } from "./DetailPanel";
import { SkillFormModal, type SkillFormValues } from "./SkillFormModal";
import { DeptFormModal, type DeptFormValues } from "./DeptFormModal";

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export function MapShell({ initial }: { initial: MapPayload }) {
  const [map, setMap] = useState<MapPayload>(initial);
  const [selection, setSelection] = useState<Selection>(() => {
    const skill =
      initial.departments
        .flatMap((d) => d.skills)
        .find((s) => s.slug === "content-calendar") ?? null;
    return skill ? { kind: "skill", skill } : { kind: "company" };
  });
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [skillModal, setSkillModal] = useState<{
    mode: "create" | "edit";
    skill?: SkillDTO | null;
  } | null>(null);
  const [deptModal, setDeptModal] = useState<{
    mode: "create" | "edit";
    department?: DepartmentDTO | null;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setSearch("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refreshSelection = useCallback((next: MapPayload, prev: Selection) => {
    if (!prev) return prev;
    if (prev.kind === "company") return prev;
    if (prev.kind === "department") {
      const d = next.departments.find((x) => x.id === prev.department.id);
      return d ? { kind: "department" as const, department: d } : null;
    }
    const skill = next.departments
      .flatMap((d) => d.skills)
      .find((s) => s.id === prev.skill.id);
    return skill ? { kind: "skill" as const, skill } : null;
  }, []);

  const applyMap = useCallback(
    (next: MapPayload) => {
      setMap(next);
      setSelection((prev) => refreshSelection(next, prev));
    },
    [refreshSelection],
  );

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const onToggleExpand = useCallback(
    async (departmentId: string) => {
      const dept = map.departments.find((d) => d.id === departmentId);
      if (!dept) return;
      const nextExpanded = !dept.expanded;

      // Optimistic UI
      setMap((prev) => ({
        ...prev,
        departments: prev.departments.map((d) =>
          d.id === departmentId ? { ...d, expanded: nextExpanded } : d,
        ),
      }));

      if (!map.isOwner) return;

      try {
        const res = await fetch(`/api/departments/${departmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expanded: nextExpanded }),
        });
        if (!res.ok) throw new Error(await readError(res));
        const data = (await res.json()) as { map: MapPayload };
        applyMap(data.map);
      } catch (err) {
        flash(err instanceof Error ? err.message : "Expand failed");
      }
    },
    [map.departments, map.isOwner, applyMap, flash],
  );

  const onAutoArrange = useCallback(async () => {
    if (!map.isOwner) {
      flash("Owner only");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expandAll: false }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { map: MapPayload };
      applyMap(data.map);
      flash("Layout saved");
    } catch (err) {
      flash(err instanceof Error ? err.message : "Auto-arrange failed");
    } finally {
      setBusy(false);
    }
  }, [map.isOwner, applyMap, flash]);

  const createSkill = useCallback(
    async (values: SkillFormValues) => {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: values.departmentId,
          slug: values.slug,
          title: values.title,
          description: values.description,
          status: values.status,
          reviewGate: values.reviewGate,
          purpose: values.purpose,
          instructions: values.instructions,
          steps: lines(values.stepsText),
          knowledgePaths: lines(values.knowledgeText),
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { map: MapPayload; skill: SkillDTO };
      applyMap(data.map);
      setSelection({ kind: "skill", skill: data.skill });
      flash(`Created ${data.skill.slug}`);
    },
    [applyMap, flash],
  );

  const updateSkill = useCallback(
    async (id: string, values: SkillFormValues) => {
      const res = await fetch(`/api/skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: values.departmentId,
          title: values.title,
          description: values.description,
          status: values.status,
          reviewGate: values.reviewGate,
          purpose: values.purpose,
          instructions: values.instructions,
          steps: lines(values.stepsText),
          knowledgePaths: lines(values.knowledgeText),
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { map: MapPayload; skill: SkillDTO };
      applyMap(data.map);
      setSelection({ kind: "skill", skill: data.skill });
      flash(`Updated ${data.skill.slug}`);
    },
    [applyMap, flash],
  );

  const createDept = useCallback(
    async (values: DeptFormValues) => {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        map: MapPayload;
        department: DepartmentDTO;
      };
      applyMap(data.map);
      setSelection({ kind: "department", department: data.department });
      flash(`Created ${data.department.name}`);
    },
    [applyMap, flash],
  );

  const updateDept = useCallback(
    async (id: string, values: DeptFormValues) => {
      const res = await fetch(`/api/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          summary: values.summary,
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as {
        map: MapPayload;
        department: DepartmentDTO;
      };
      applyMap(data.map);
      setSelection({ kind: "department", department: data.department });
      flash(`Updated ${data.department.name}`);
    },
    [applyMap, flash],
  );

  const stats = map.stats;
  const searchHint = useMemo(
    () => (search ? `Filtering “${search}”` : "Search skills, departments…"),
    [search],
  );

  return (
    <div className="flex min-h-0 flex-1">
      <main className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(214,243,31,0.04),transparent_60%),#0b0c0e]">
        <div className="flex items-center justify-between border-b border-matos-soft px-[22px] py-4">
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              Company map
            </h1>
            <div className="mt-1.5 flex flex-wrap gap-[18px] text-xs text-matos-muted">
              <span>
                <b className="font-semibold text-matos-text">
                  {stats.departmentCount}
                </b>{" "}
                Departments
              </span>
              <span>
                <b className="font-semibold text-matos-citron">
                  {stats.authored}
                </b>{" "}
                Authored
              </span>
              <span>
                <b className="font-semibold text-matos-text">{stats.planned}</b>{" "}
                Planned
              </span>
              <span>
                <b className="font-semibold text-matos-text">{stats.missing}</b>{" "}
                Missing sources
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {map.isOwner && (
              <Button
                variant="ghost"
                onClick={() => setDeptModal({ mode: "create" })}
              >
                New department
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={onAutoArrange}
              disabled={busy || !map.isOwner}
              title={map.isOwner ? "Deterministic layout + persist" : "Owner only"}
            >
              Auto arrange
            </Button>
            <Button
              variant="primary"
              onClick={() => setSkillModal({ mode: "create" })}
              disabled={!map.isOwner}
              title={map.isOwner ? "Create skill" : "Owner only"}
            >
              New skill
            </Button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <div className="absolute left-7 top-[18px] z-10 w-[280px]">
            <label className="sr-only" htmlFor="map-search">
              Search skills and departments
            </label>
            <input
              ref={searchRef}
              id="map-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchHint}
              className="w-full rounded-[9px] border border-matos-border bg-matos-panel px-3 py-2.5 text-xs text-matos-text outline-none placeholder:text-matos-muted focus:border-matos-citron"
              autoComplete="off"
            />
            <div className="mt-1 px-1 text-[10px] text-matos-muted2">
              ⌘K / Ctrl+K · Esc clears
            </div>
          </div>

          {toast && (
            <div className="absolute right-4 top-4 z-10 rounded-lg border border-matos-border bg-matos-panel px-3 py-2 text-xs text-matos-citron">
              {toast}
            </div>
          )}

          <CompanyMap
            map={map}
            selection={selection}
            search={search}
            onSelect={setSelection}
            onToggleExpand={onToggleExpand}
          />
        </div>
      </main>

      <DetailPanel
        selection={selection}
        departments={map.departments}
        isOwner={map.isOwner}
        onEditSkill={(skill) => setSkillModal({ mode: "edit", skill })}
        onEditDepartment={(department) =>
          setDeptModal({ mode: "edit", department })
        }
        onMapUpdate={(next, skill) => {
          applyMap(next);
          setSelection({ kind: "skill", skill });
        }}
      />

      <SkillFormModal
        open={!!skillModal}
        mode={skillModal?.mode ?? "create"}
        departments={map.departments}
        initial={skillModal?.skill}
        onClose={() => setSkillModal(null)}
        onSubmit={async (values) => {
          if (skillModal?.mode === "edit" && skillModal.skill) {
            await updateSkill(skillModal.skill.id, values);
          } else {
            await createSkill(values);
          }
        }}
      />

      <DeptFormModal
        open={!!deptModal}
        mode={deptModal?.mode ?? "create"}
        initial={deptModal?.department}
        onClose={() => setDeptModal(null)}
        onSubmit={async (values) => {
          if (deptModal?.mode === "edit" && deptModal.department) {
            await updateDept(deptModal.department.id, values);
          } else {
            await createDept(values);
          }
        }}
      />
    </div>
  );
}
