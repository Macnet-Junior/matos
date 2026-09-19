"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@matos/ui";
import { downloadFromResponse } from "./download-response";

export function KnowledgeArchiveActions({ enabled }: { enabled: boolean }) {
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
      const res = await fetch("/api/knowledge/export");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Export failed (${res.status})`);
      }
      await downloadFromResponse(res, "matos-knowledge.zip");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    const confirmed = window.confirm(
      "Merge this zip into knowledge/?\n\nFiles in the archive overwrite matching paths. Other markdown files stay. Paths outside knowledge/ are rejected.",
    );
    if (!confirmed) return;

    setBusy("import");
    setError(null);
    setNote(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("confirm", "1");
      const res = await fetch("/api/knowledge/import", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        written?: string[];
        overwritten?: string[];
      };
      if (!res.ok) {
        throw new Error(data.error ?? `Import failed (${res.status})`);
      }
      const written = data.written?.length ?? 0;
      const overwritten = data.overwritten?.length ?? 0;
      setNote(`Wrote ${written} file(s) · ${overwritten} overwritten`);
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
          {busy === "export" ? "Exporting…" : "Export ZIP"}
        </Button>
        <Button
          variant="secondary"
          disabled={!enabled || busy !== null}
          onClick={() => inputRef.current?.click()}
        >
          {busy === "import" ? "Importing…" : "Import ZIP"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
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
            ? "Merge: overwrite matching knowledge/ paths · other files stay"
            : "Requires Owner or Author"}
        </span>
      )}
    </div>
  );
}
