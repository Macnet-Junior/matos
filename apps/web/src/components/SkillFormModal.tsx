"use client";

import { useEffect, useState } from "react";
import { Button } from "@matos/ui";
import type { DepartmentDTO, SkillDTO, SkillStatus, ReviewGate } from "@/lib/types";

export type SkillFormValues = {
  departmentId: string;
  slug: string;
  title: string;
  description: string;
  status: SkillStatus;
  reviewGate: ReviewGate;
  purpose: string;
  instructions: string;
  stepsText: string;
  knowledgeText: string;
};

export function SkillFormModal({
  open,
  mode,
  departments,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  departments: DepartmentDTO[];
  initial?: SkillDTO | null;
  onClose: () => void;
  onSubmit: (values: SkillFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<SkillFormValues>({
    departmentId: departments[0]?.id ?? "",
    slug: "",
    title: "",
    description: "",
    status: "planned",
    reviewGate: "Warm",
    purpose: "",
    instructions: "",
    stepsText: "",
    knowledgeText: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setValues({
        departmentId: initial.departmentId,
        slug: initial.slug,
        title: initial.title,
        description: initial.description,
        status: initial.status,
        reviewGate: initial.reviewGate,
        purpose: initial.purpose,
        instructions: initial.instructions,
        stepsText: initial.steps.join("\n"),
        knowledgeText: initial.knowledge.map((k) => k.path).join("\n"),
      });
    } else {
      setValues({
        departmentId: departments[0]?.id ?? "",
        slug: "",
        title: "",
        description: "",
        status: "planned",
        reviewGate: "Warm",
        purpose: "",
        instructions: "",
        stepsText: "",
        knowledgeText: "",
      });
    }
    setError(null);
  }, [open, mode, initial, departments]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-form-title"
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-matos-border bg-matos-elev p-4 shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="skill-form-title" className="text-sm font-semibold tracking-tight">
            {mode === "create" ? "New skill" : "Edit skill"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-matos-muted hover:text-matos-text"
          >
            Close
          </button>
        </div>

        <div className="grid gap-3 text-xs">
          <label className="grid gap-1">
            <span className="text-matos-muted2">Department</span>
            <select
              className="rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2"
              value={values.departmentId}
              onChange={(e) =>
                setValues((v) => ({ ...v, departmentId: e.target.value }))
              }
              required
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>

          {mode === "create" && (
            <label className="grid gap-1">
              <span className="text-matos-muted2">Slug</span>
              <input
                className="rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2 font-mono"
                value={values.slug}
                onChange={(e) =>
                  setValues((v) => ({ ...v, slug: e.target.value }))
                }
                placeholder="hook-lab"
                required
              />
            </label>
          )}

          <label className="grid gap-1">
            <span className="text-matos-muted2">Title</span>
            <input
              className="rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2"
              value={values.title}
              onChange={(e) =>
                setValues((v) => ({ ...v, title: e.target.value }))
              }
              required
            />
          </label>

          <label className="grid gap-1">
            <span className="text-matos-muted2">Description</span>
            <textarea
              className="min-h-[64px] rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2"
              value={values.description}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <span className="text-matos-muted2">Status</span>
              <select
                className="rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2"
                value={values.status}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    status: e.target.value as SkillStatus,
                  }))
                }
              >
                <option value="authored">Authored</option>
                <option value="planned">Planned</option>
                <option value="missing">Missing</option>
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-matos-muted2">Review gate</span>
              <select
                className="rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2"
                value={values.reviewGate}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    reviewGate: e.target.value as ReviewGate,
                  }))
                }
              >
                <option value="Cold">Cold</option>
                <option value="Warm">Warm</option>
                <option value="Hot">Hot</option>
              </select>
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-matos-muted2">Purpose</span>
            <textarea
              className="min-h-[48px] rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2"
              value={values.purpose}
              onChange={(e) =>
                setValues((v) => ({ ...v, purpose: e.target.value }))
              }
            />
          </label>

          <label className="grid gap-1">
            <span className="text-matos-muted2">Instructions</span>
            <textarea
              className="min-h-[88px] rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2"
              value={values.instructions}
              onChange={(e) =>
                setValues((v) => ({ ...v, instructions: e.target.value }))
              }
            />
          </label>

          <label className="grid gap-1">
            <span className="text-matos-muted2">Steps (one per line)</span>
            <textarea
              className="min-h-[72px] rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2 font-mono"
              value={values.stepsText}
              onChange={(e) =>
                setValues((v) => ({ ...v, stepsText: e.target.value }))
              }
            />
          </label>

          <label className="grid gap-1">
            <span className="text-matos-muted2">Knowledge paths (one per line)</span>
            <textarea
              className="min-h-[56px] rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2 font-mono"
              value={values.knowledgeText}
              onChange={(e) =>
                setValues((v) => ({ ...v, knowledgeText: e.target.value }))
              }
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 text-xs text-matos-danger" role="alert">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
