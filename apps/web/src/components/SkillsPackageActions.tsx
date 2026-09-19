"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@matos/ui";
import { downloadFromResponse } from "./download-response";

export function SkillsPackageActions({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function onExport() {
    setBusy("export");
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/skills/export");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Export failed (${res.status})`);
      }
      await downloadFromResponse(res, "matos-skills.json");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    const confirmed = window.confirm(
      "Import skills from this file?\n\nMatching slugs in the same department will be updated. Other skills are not deleted.",
    );
    if (!confirmed) return;

    setBusy("import");
    setError(null);
    setNote(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/skills/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: text,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        created?: number;
        updated?: number;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Import failed (${res.status})`);
      }
      setNote(
        `Imported ${data.created ?? 0} new · ${data.updated ?? 0} updated`,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          variant="secondary"
          disabled={!enabled || busy !== null}
          onClick={onExport}
        >
          {busy === "export" ? "Exporting…" : "Export JSON"}
        </Button>
        <Button
          variant="secondary"
          disabled={!enabled || busy !== null}
          onClick={() => inputRef.current?.click()}
        >
          {busy === "import" ? "Importing…" : "Import JSON"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.jsonl,application/json,text/plain"
          className="hidden"
          onChange={(e) => void onPickFile(e.target.files?.[0])}
        />
      </div>
      {error ? (
        <span className="max-w-sm text-right text-[11px] text-matos-danger">
          {error}
        </span>
      ) : note ? (
        <span className="max-w-sm text-right text-[11px] text-matos-citron">
          {note}
        </span>
      ) : (
        <span className="max-w-sm text-right text-[10px] text-matos-muted2">
          {enabled
            ? "Owner / Author · upsert by department + slug · no wipe"
            : "Requires Owner or Author"}
        </span>
      )}
    </div>
  );
}
