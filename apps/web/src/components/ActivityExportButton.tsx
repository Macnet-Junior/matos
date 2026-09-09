"use client";

import { useState } from "react";
import { Button } from "@matos/ui";

export function ActivityExportButton({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return null;

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/activity/export");
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename = match?.[1] ?? "matos-activity.json";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" disabled={busy} onClick={onExport}>
        {busy ? "Exporting…" : "Download JSON"}
      </Button>
      {error ? (
        <span className="text-[11px] text-matos-danger">{error}</span>
      ) : (
        <span className="text-[10px] text-matos-muted2">Owner only</span>
      )}
    </div>
  );
}
