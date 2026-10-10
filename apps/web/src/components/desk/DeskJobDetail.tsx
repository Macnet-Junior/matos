"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@matos/ui";
import { DeskSourcesPanel } from "@/components/desk/DeskSourcesPanel";
import { OverflowMenu, type OverflowItem } from "@/components/OverflowMenu";
import { DESK_STAGES, STAGE_LABELS, type DeskStage } from "@/lib/desk/stages";
import { deskJobActionLayout, deskStageHeadline, type DeskActionId } from "@/lib/ui-choices";
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
        body: JSON.stringify({
          action,
          note: note || undefined,
          stage: currentStage ?? undefined,
        }),
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

  const dirty = Boolean(artifact) && body !== (artifact?.body ?? "");
  const canReview = Boolean(
    canApprove && artifact && artifact.reviewState !== "approved",
  );
  const actions = deskJobActionLayout({
    canRun,
    canReview,
    hasArtifact: Boolean(artifact),
    dirty,
  });
  const actionRun: Record<DeskActionId, () => void> = {
    run: () => void runStage(),
    save: () => void saveArtifact(),
    approve: () => void review("approve"),
    request_changes: () => void review("request_changes"),
    regenerate: () => void runStage(),
  };
  const actionLabel: Record<DeskActionId, string> = {
    run: "Run stage",
    save: "Save edits",
    approve: "Approve → next stage",
    request_changes: "Request changes",
    regenerate: "Regenerate",
  };
  const overflow: OverflowItem[] = actions.more.map((id) => ({
    label: actionLabel[id],
    onSelect: actionRun[id],
    disabled: busy || (id === "approve" && artifact?.reviewState === "pending"),
  }));

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

        <div className="mt-4 max-w-xl">
          <p className="text-[11px] text-matos-muted">{deskStageHeadline(job.stage)}</p>
          <ol className="mt-1.5 flex gap-1" aria-label={deskStageHeadline(job.stage)}>
            {DESK_STAGES.map((stage) => {
              const art = job.artifacts.find((item) => item.stage === stage);
              const current = job.stage === stage;
              const approved = art?.reviewState === "approved";
              const state = current ? "current" : approved ? "approved" : "waiting";
              return (
                <li key={stage} className="min-w-0 flex-1">
                  <span
                    className={`block h-1 rounded-full ${
                      state === "waiting" ? "bg-matos-soft" : "bg-matos-citron"
                    } ${current ? "" : approved ? "opacity-70" : ""}`}
                  />
                  <span className="sr-only">
                    {STAGE_LABELS[stage]} {state}
                  </span>
                </li>
              );
            })}
          </ol>
          <details className="mt-2">
            <summary className="cursor-pointer list-none text-[11px] text-matos-muted hover:text-matos-text [&::-webkit-details-marker]:hidden">
              All stages
            </summary>
            <ol className="mt-1.5 space-y-1 text-[11px] text-matos-muted">
              {DESK_STAGES.map((stage) => {
                const art = job.artifacts.find((item) => item.stage === stage);
                const current = job.stage === stage;
                const approved = art?.reviewState === "approved";
                const state = current ? "current" : approved ? "approved" : "waiting";
                return (
                  <li key={stage}>
                    {STAGE_LABELS[stage]} · {state}
                  </li>
                );
              })}
              {job.stage === "filed" ? <li>Filed</li> : null}
            </ol>
          </details>
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
                      ? `Review: ${artifact.reviewState}${dirty ? " · unsaved edits" : ""}`
                      : "No draft yet. Run this stage to write one."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {actions.primary ? (
                    <Button
                      type="button"
                      variant="primary"
                      disabled={
                        busy ||
                        (actions.primary === "approve" && artifact?.reviewState === "pending")
                      }
                      onClick={actionRun[actions.primary]}
                    >
                      {actionLabel[actions.primary]}
                    </Button>
                  ) : null}
                  {actions.secondary ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        busy ||
                        (actions.secondary === "approve" && artifact?.reviewState === "pending")
                      }
                      onClick={actionRun[actions.secondary]}
                    >
                      {actionLabel[actions.secondary]}
                    </Button>
                  ) : null}
                  <OverflowMenu items={overflow} />
                </div>
              </div>

              {canReview ? (
                <details className="mb-3 rounded-lg border border-matos-border bg-matos-elev px-3 py-2">
                  <summary className="cursor-pointer list-none text-[11px] text-matos-muted [&::-webkit-details-marker]:hidden">
                    Add a review note
                  </summary>
                  <label className="mt-2 block text-[11px] text-matos-muted" htmlFor="desk-review-note">
                    Review note
                    <input
                      id="desk-review-note"
                      className="mt-1 w-full rounded-lg border border-matos-border bg-matos-panel px-3 py-2 text-sm text-matos-text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Optional note for approve or changes"
                    />
                  </label>
                  {artifact?.skill ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-matos-muted">
                      Draft is wrong? The fix is usually upstream of the model.{" "}
                      <Link
                        href={artifact.skill.href}
                        className="text-matos-citron underline decoration-dotted underline-offset-2"
                      >
                        {artifact.skill.label}
                      </Link>
                      . {artifact.skill.reason}
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] leading-relaxed text-matos-muted">
                      This stage materialises approved material rather than
                      authoring it, so there is no skill behind it to fix.
                    </p>
                  )}
                </details>
              ) : null}

              <textarea
                aria-label={
                  currentStage ? `${STAGE_LABELS[currentStage]} artifact` : "Artifact"
                }
                className="min-h-[240px] w-full flex-1 rounded-xl border border-matos-border bg-matos-panel p-3 font-mono text-[12px] leading-relaxed text-matos-text"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                readOnly={!canRun || !artifact}
                placeholder="Run the stage to generate an editable artifact…"
              />
            </>
          )}

          <div className="mt-4">
            <DeskSourcesPanel jobId={job.id} canRun={canRun} />
          </div>

          {error ? (
            <p className="mt-3 text-xs text-matos-danger">{error}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
