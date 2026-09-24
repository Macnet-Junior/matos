"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@matos/ui";
import { DESK_STAGES, STAGE_LABELS, type DeskStage } from "@/lib/desk/stages";
import type { DeskJobDTO } from "@/lib/desk";

export function DeskJobDetail({
  job: initial,
  canRun,
  canApprove,
}: {
  job: DeskJobDTO;
  canRun: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [job, setJob] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const currentStage = job.stage === "filed" ? null : (job.stage as DeskStage);
  const artifact = useMemo(() => {
    if (!currentStage) return null;
    return job.artifacts.find((a) => a.stage === currentStage) ?? null;
  }, [job.artifacts, currentStage]);

  const [body, setBody] = useState(artifact?.body ?? "");

  useEffect(() => {
    setBody(artifact?.body ?? "");
  }, [artifact?.id, artifact?.updatedAt, artifact?.body]);

  async function runStage() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/desk/jobs/${job.id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      setJob(data.job);
      const art = data.job.artifacts.find(
        (a: { stage: string }) => a.stage === data.job.stage,
      );
      setBody(art?.body ?? "");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveArtifact() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/desk/jobs/${job.id}/artifact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setJob(data.job);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function review(action: "approve" | "request_changes") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/desk/jobs/${job.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Review failed");
      setJob(data.job);
      setNote("");
      const next = data.job.stage;
      const art = data.job.artifacts.find(
        (a: { stage: string }) => a.stage === next,
      );
      setBody(art?.body ?? "");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/desk"
              className="text-[11px] text-matos-muted hover:text-matos-text"
            >
              ← Desk
            </Link>
            <h1 className="mt-1 text-base font-semibold tracking-tight">
              {job.title}
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-matos-muted">
              {job.topic} · {job.audience}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={job.stage === "filed" ? "citron" : "muted"}>
              {job.stage}
            </Badge>
            <Badge tone="muted">{job.status.replaceAll("_", " ")}</Badge>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {DESK_STAGES.map((s) => {
            const art = job.artifacts.find((a) => a.stage === s);
            const active = job.stage === s;
            const approved = art?.reviewState === "approved";
            return (
              <div
                key={s}
                className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${
                  active
                    ? "border-matos-citron bg-[rgba(214,243,31,0.14)] text-matos-text"
                    : approved
                      ? "border-matos-border text-matos-text"
                      : "border-matos-soft text-matos-muted2"
                }`}
              >
                {STAGE_LABELS[s]}
                {approved ? " ✓" : active ? " ·" : ""}
              </div>
            );
          })}
          {job.stage === "filed" ? (
            <div className="rounded-lg border border-matos-citron bg-[rgba(214,243,31,0.14)] px-2.5 py-1.5 text-[11px]">
              Filed
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[280px_1fr]">
        <aside className="overflow-auto border-r border-matos-soft bg-matos-elev p-4">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Brief
          </h2>
          <dl className="mt-3 space-y-3 text-xs">
            <div>
              <dt className="text-matos-muted2">Offer / CTA</dt>
              <dd className="mt-0.5 text-matos-text">{job.offerCta}</dd>
            </div>
            <div>
              <dt className="text-matos-muted2">Channels</dt>
              <dd className="mt-0.5 text-matos-text">{job.channels.join(", ")}</dd>
            </div>
            <div>
              <dt className="text-matos-muted2">Due</dt>
              <dd className="mt-0.5 text-matos-text">
                {job.dueAt
                  ? new Date(job.dueAt).toLocaleDateString()
                  : "Unset"}
              </dd>
            </div>
            <div>
              <dt className="text-matos-muted2">Created by</dt>
              <dd className="mt-0.5 text-matos-text">{job.createdBy}</dd>
            </div>
          </dl>

          {job.calendarItems.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
                Calendar packs
              </h3>
              <ul className="mt-2 space-y-1.5 text-[11px] text-matos-muted">
                {job.calendarItems.map((c) => (
                  <li key={c.id}>
                    {c.channel} ·{" "}
                    {new Date(c.scheduledAt).toLocaleDateString()} ·{" "}
                    {c.simulated ? "simulated — not live" : c.status}
                  </li>
                ))}
              </ul>
              <Link
                href="/calendar"
                className="mt-2 inline-block text-[11px] text-matos-citron"
              >
                Open calendar →
              </Link>
            </div>
          ) : null}

          {job.inboxItems.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
                Echo drafts
              </h3>
              <ul className="mt-2 space-y-1.5 text-[11px] text-matos-muted">
                {job.inboxItems.map((i) => (
                  <li key={i.id}>
                    {i.subject} · {i.status}
                  </li>
                ))}
              </ul>
              <Link
                href="/inbox"
                className="mt-2 inline-block text-[11px] text-matos-citron"
              >
                Open inbox →
              </Link>
            </div>
          ) : null}
        </aside>

        <section className="flex min-h-0 flex-col overflow-auto p-4">
          {job.stage === "filed" ? (
            <div className="rounded-xl border border-matos-border bg-matos-panel p-4 text-sm text-matos-muted">
              This job is filed in{" "}
              <Link href="/library/desk" className="text-matos-citron">
                Library → Desk
              </Link>
              . No further stage runs.
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">
                    {currentStage
                      ? `${STAGE_LABELS[currentStage]} artifact`
                      : "Artifact"}
                  </h2>
                  <p className="text-[11px] text-matos-muted">
                    {artifact
                      ? `Review: ${artifact.reviewState}`
                      : "No artifact yet — run this stage to generate a placeholder (or OpenAI if keyed)."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canRun ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={runStage}
                    >
                      {artifact ? "Regenerate" : "Run stage"}
                    </Button>
                  ) : null}
                  {canRun && artifact ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={saveArtifact}
                    >
                      Save edits
                    </Button>
                  ) : null}
                </div>
              </div>

              <textarea
                className="min-h-[320px] w-full flex-1 rounded-xl border border-matos-border bg-matos-panel p-3 font-mono text-[12px] leading-relaxed text-matos-text"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                readOnly={!canRun || !artifact}
                placeholder="Run the stage to generate an editable artifact…"
              />

              {canApprove && artifact && artifact.reviewState !== "approved" ? (
                <div className="mt-3 rounded-xl border border-matos-border bg-matos-elev p-3">
                  <label className="block text-[11px] text-matos-muted">
                    Review note
                    <input
                      className="mt-1 w-full rounded-lg border border-matos-border bg-matos-panel px-3 py-2 text-sm text-matos-text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional note for approve / changes"
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      disabled={busy || artifact.reviewState === "pending"}
                      onClick={() => review("approve")}
                    >
                      Approve → next stage
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => review("request_changes")}
                    >
                      Request changes
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {error ? (
            <p className="mt-3 text-xs text-matos-danger">{error}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
