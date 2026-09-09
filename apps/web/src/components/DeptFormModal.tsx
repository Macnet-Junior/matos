"use client";

import { useEffect, useState } from "react";
import { Button } from "@matos/ui";
import type { DepartmentDTO } from "@/lib/types";

export type DeptFormValues = {
  name: string;
  summary: string;
  slug: string;
};

export function DeptFormModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial?: DepartmentDTO | null;
  onClose: () => void;
  onSubmit: (values: DeptFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<DeptFormValues>({
    name: "",
    summary: "",
    slug: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setValues({
        name: initial.name,
        summary: initial.summary,
        slug: initial.slug,
      });
    } else {
      setValues({ name: "", summary: "", slug: "" });
    }
    setError(null);
  }, [open, mode, initial]);

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
      aria-labelledby="dept-form-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-matos-border bg-matos-elev p-4 shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="dept-form-title" className="text-sm font-semibold tracking-tight">
            {mode === "create" ? "New department" : "Edit department"}
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
          {mode === "create" && (
            <label className="grid gap-1">
              <span className="text-matos-muted2">Slug</span>
              <input
                className="rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2 font-mono"
                value={values.slug}
                onChange={(e) =>
                  setValues((v) => ({ ...v, slug: e.target.value }))
                }
                required
              />
            </label>
          )}
          <label className="grid gap-1">
            <span className="text-matos-muted2">Name</span>
            <input
              className="rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2"
              value={values.name}
              onChange={(e) =>
                setValues((v) => ({ ...v, name: e.target.value }))
              }
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-matos-muted2">Summary</span>
            <textarea
              className="min-h-[64px] rounded-lg border border-matos-border bg-matos-panel px-2.5 py-2"
              value={values.summary}
              onChange={(e) =>
                setValues((v) => ({ ...v, summary: e.target.value }))
              }
              required
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
