"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "@matos/ui";
import type { DeskSourceDTO } from "@/lib/desk/sources";
import type { SourceGradeView } from "@/lib/desk/youtube-source";

type SourceRow = DeskSourceDTO & { grade: SourceGradeView | null };

type Load = {
  sources: SourceRow[];
  gemini: { configured: boolean; message: string | null };
};

function statusLabel(status: string): string {
  if (status === "transcribed") return "Done";
  if (status === "processing") return "Processing";
  if (status === "failed") return "Failed";
  return "Pending";
}

function statusTone(status: string): "citron" | "muted" | "danger" {
  if (status === "transcribed") return "citron";
  if (status === "failed") return "danger";
  return "muted";
}

export function DeskSourcesPanel({
  jobId,
  canRun,
}: {
  jobId: string;
  canRun: boolean;
}) {
  const [load, setLoad] = useState<Load | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/desk/sources?jobId=${encodeURIComponent(jobId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load sources");
    setLoad({ sources: data.sources ?? [], gemini: data.gemini });
  }, [jobId]);

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load sources");
    });
  }, [refresh]);

  async function submit(mode: "youtube" | "transcript") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/desk/youtube-skill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          title: title.trim() || undefined,
          youtubeUrl: mode === "youtube" ? youtubeUrl.trim() : undefined,
          transcript: mode === "transcript" ? transcript : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not draft a skill");
      if (mode === "youtube") setYoutubeUrl("");
      if (mode === "transcript") setTranscript("");
      setTitle("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft a skill");
    } finally {
      setBusy(false);
    }
  }

  async function retry(sourceId: string) {
    setBusy(true);
    setError(null);
    setLoad((prev) =>
      prev
        ? {
            ...prev,
            sources: prev.sources.map((source) =>
              source.id === sourceId
                ? { ...source, status: "processing", error: null, grade: null }
                : source,
            ),
          }
        : prev,
    );
    try {
      const res = await fetch(`/api/desk/youtube-skill/${sourceId}/retry`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not retry");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retry");
    } finally {
      setBusy(false);
    }
  }

  const sources = load?.sources ?? [];

  return (
    <div className="mb-4 rounded-xl border border-matos-border bg-matos-panel p-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">Sources</h2>
        <p className="mt-0.5 text-[11px] text-matos-muted">
          Paste a YouTube link. Skillwright asks Gemini to draft a skill and grade the words.
        </p>
      </div>

      {load?.gemini && !load.gemini.configured && load.gemini.message ? (
        <p className="mt-3 rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-xs text-matos-text">
          {load.gemini.message}
        </p>
      ) : null}

      {canRun ? (
        <div className="mt-3 grid gap-3">
          <label className="block text-[11px] text-matos-muted">
            Title (optional)
            <input
              className="mt-1 w-full rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-sm text-matos-text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Name this source"
              maxLength={160}
            />
          </label>
          <label className="block text-[11px] text-matos-muted">
            YouTube link
            <input
              className="mt-1 w-full rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-sm text-matos-text"
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </label>
          <div>
            <Button
              type="button"
              variant="primary"
              disabled={busy || !youtubeUrl.trim()}
              onClick={() => submit("youtube")}
            >
              {busy ? "Working…" : "Turn this video into a skill"}
            </Button>
          </div>
          <details className="rounded-lg border border-matos-soft px-3 py-2">
            <summary className="cursor-pointer list-none text-[11px] text-matos-muted hover:text-matos-text [&::-webkit-details-marker]:hidden">
              Paste a transcript instead
            </summary>
            <label className="mt-2 block text-[11px] text-matos-muted">
              Transcript
              <span className="mt-0.5 block text-matos-muted2">
                Same draft and the same grade, for when Gemini cannot read the video.
                Start a line with [mm:ss] when you have the times. The title above is used if you set one.
              </span>
              <textarea
                className="mt-1 min-h-[96px] w-full rounded-lg border border-matos-border bg-matos-elev px-3 py-2 font-mono text-[12px] text-matos-text"
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder={"[00:00] The first thing I say\n[00:20] The point of the video"}
              />
            </label>
            <div className="mt-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !transcript.trim()}
                onClick={() => submit("transcript")}
              >
                Use this transcript
              </Button>
            </div>
          </details>
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-matos-muted">You can read sources. You cannot add one.</p>
      )}

      {busy ? (
        <p className="mt-3 text-xs text-matos-muted">Processing. This can take a minute.</p>
      ) : null}

      {error ? <p className="mt-3 text-xs text-matos-danger">{error}</p> : null}

      <ul className="mt-4 space-y-3">
        {sources.length === 0 ? (
          <li className="text-xs text-matos-muted">No sources yet.</li>
        ) : (
          sources.map((source) => (
            <li key={source.id} className="rounded-lg border border-matos-soft bg-matos-elev p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-matos-text">{source.title}</span>
                <Badge tone={statusTone(source.status)}>{statusLabel(source.status)}</Badge>
                {source.provider ? (
                  <span className="text-[10px] uppercase tracking-wide text-matos-muted2">
                    {source.provider}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 break-all text-[11px] text-matos-muted">{source.origin}</p>

              {source.status === "failed" && source.error ? (
                <p className="mt-2 text-xs text-matos-danger">{source.error}</p>
              ) : null}
              {source.status === "pending" && source.error ? (
                <p className="mt-2 text-xs text-matos-muted">{source.error}</p>
              ) : null}
              {source.status === "processing" ? (
                <p className="mt-2 text-xs text-matos-muted">Reading it now. This can take a minute.</p>
              ) : null}

              {source.status === "failed" && canRun ? (
                <div className="mt-2">
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => retry(source.id)}>
                    Try again
                  </Button>
                </div>
              ) : null}

              {source.status === "transcribed" && source.skillReadiness === "draft" ? (
                <div className="mt-3 text-xs text-matos-text">
                  <p>
                    Draft skill <span className="font-semibold">{source.skillName || "untitled"}</span>.
                    It is not turned on, and it is not watched.
                  </p>
                  {source.grade ? <GradeBlock grade={source.grade} /> : null}
                  {source.skillDraft ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-matos-citron">
                        Show the draft skill file
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-matos-soft bg-matos-panel p-2 font-mono text-[11px] leading-relaxed text-matos-muted">
                        {source.skillDraft}
                      </pre>
                    </details>
                  ) : null}
                </div>
              ) : null}

              {source.status === "transcribed" && source.skillReadiness !== "draft" && source.grade ? (
                <div className="mt-3">
                  <GradeBlock grade={source.grade} />
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function GradeBlock({ grade }: { grade: SourceGradeView }) {
  return (
    <div className="mt-2 rounded-lg border border-matos-soft px-2 py-2">
      <p className="text-[11px] font-semibold text-matos-text">
        {grade.firstProblem
          ? `Grade: fix ${grade.firstProblem} first.`
          : grade.ok
            ? "Grade: the checks that ran came back clean."
            : "Grade: nothing passed."}
      </p>
      {grade.findings.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {grade.findings.map((finding) => (
            <li key={`${finding.skill}-${finding.code}`} className="text-[11px] text-matos-muted">
              [{finding.skill}] {finding.ok ? "ok" : finding.code} — {finding.detail}
            </li>
          ))}
        </ul>
      ) : null}
      {grade.skipped.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {grade.skipped.map((skip) => (
            <li key={skip.skill} className="text-[11px] text-matos-muted2">
              Skipped {skip.skill} (not a pass): {skip.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
