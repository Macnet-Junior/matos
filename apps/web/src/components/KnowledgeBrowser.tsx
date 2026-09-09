"use client";

import { useEffect, useState } from "react";
import { MarkdownView } from "./MarkdownView";

type LinkRow = {
  id: string;
  path: string;
  skillSlug: string;
  skillTitle: string;
};

export function KnowledgeBrowser({
  files,
  links,
}: {
  files: string[];
  links: LinkRow[];
}) {
  const [active, setActive] = useState<string | null>(files[0] ?? null);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="grid gap-4 p-[22px] lg:grid-cols-2">
      <section className="rounded-xl border border-matos-border bg-matos-panel p-4">
        <h2 className="text-xs font-semibold tracking-tight text-matos-text">
          Files
        </h2>
        <ul className="mt-3 space-y-2">
          {files.map((f) => (
            <li key={f}>
              <button
                type="button"
                onClick={() => setActive(f)}
                className={`w-full rounded-lg border px-2.5 py-2 text-left font-mono text-[11px] transition-colors ${
                  active === f
                    ? "border-matos-citron bg-matos-elev text-matos-text"
                    : "border-matos-soft bg-matos-elev text-matos-muted"
                }`}
              >
                {f}
              </button>
            </li>
          ))}
        </ul>
        <h2 className="mt-5 text-xs font-semibold tracking-tight text-matos-text">
          Skill links
        </h2>
        <ul className="mt-3 space-y-2">
          {links.map((l) => (
            <li
              key={l.id}
              className="rounded-lg border border-matos-soft bg-matos-elev px-2.5 py-2 text-[11px]"
            >
              <button
                type="button"
                className="font-mono text-matos-citron"
                onClick={() => setActive(l.path)}
              >
                {l.path}
              </button>
              <div className="mt-1 text-matos-muted">
                {l.skillSlug} · {l.skillTitle}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-matos-border bg-matos-panel p-4">
        <h2 className="text-xs font-semibold tracking-tight text-matos-text">
          Preview
        </h2>
        <div className="mt-3 min-h-[240px] rounded-lg border border-matos-soft bg-matos-bg p-3">
          {loading ? (
            <p className="text-xs text-matos-muted">Loading…</p>
          ) : error ? (
            <p className="text-xs text-matos-danger">{error}</p>
          ) : (
            <MarkdownView content={content} />
          )}
        </div>
      </section>
    </div>
  );
}
