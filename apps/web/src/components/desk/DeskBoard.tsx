"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@matos/ui";
import { DESK_STAGES, STAGE_BLURBS, STAGE_LABELS, type DeskStage } from "@/lib/desk/stages";
import type { DeskJobDTO } from "@/lib/desk";

const CHANNELS = [
  "x",
  "linkedin",
  "newsletter",
  "blog",
  "instagram",
  "youtube",
] as const;

function statusTone(
  status: string,
): "citron" | "muted" | "danger" {
  if (status === "awaiting_approval" || status === "approved") return "citron";
  if (status === "changes_requested") return "danger";
  return "muted";
}

export function DeskBoard({
  jobs: initial,
  canRun,
}: {
  jobs: DeskJobDTO[];
  canRun: boolean;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initial);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [offerCta, setOfferCta] = useState("");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [channels, setChannels] = useState<string[]>(["linkedin", "x"]);

  const byStage = useMemo(() => {
    const map = Object.fromEntries(
      DESK_STAGES.map((s) => [s, [] as DeskJobDTO[]]),
    ) as Record<DeskStage, DeskJobDTO[]>;
    for (const job of jobs) {
      if (job.stage === "filed") continue;
      if (job.stage in map) map[job.stage as DeskStage].push(job);
    }
    return map;
  }, [jobs]);

  function toggleChannel(ch: string) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  }

  async function createBrief() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/desk/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title || undefined,
          topic,
          audience,
          offerCta,
          channels,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setJobs((prev) => [data.job, ...prev]);
      setOpen(false);
      setTopic("");
      setAudience("");
      setOfferCta("");
      setTitle("");
      setDueAt("");
      router.push(`/desk/${data.job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-xs text-matos-muted">
          Newsroom pipeline — Scout → Ghost → Editor → Press → Clock → Echo.
          Each stage needs human approve before the next runs. Workflows stay
          separate for company skill automations.
        </p>
        {canRun ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close brief" : "New brief"}
          </Button>
        ) : null}
      </div>

      {open ? (
        <div className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-sm font-semibold tracking-tight">Desk brief</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-matos-muted">
              Title (optional)
              <input
                className="mt-1 w-full rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-sm text-matos-text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Working title"
              />
            </label>
            <label className="block text-xs text-matos-muted">
              Due date
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-sm text-matos-text"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>
            <label className="block text-xs text-matos-muted sm:col-span-2">
              Topic
              <input
                className="mt-1 w-full rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-sm text-matos-text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What is this piece about?"
              />
            </label>
            <label className="block text-xs text-matos-muted">
              Audience
              <input
                className="mt-1 w-full rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-sm text-matos-text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Who is this for?"
              />
            </label>
            <label className="block text-xs text-matos-muted">
              Offer / CTA
              <input
                className="mt-1 w-full rounded-lg border border-matos-border bg-matos-elev px-3 py-2 text-sm text-matos-text"
                value={offerCta}
                onChange={(e) => setOfferCta(e.target.value)}
                placeholder="What should they do next?"
              />
            </label>
            <div className="sm:col-span-2">
              <div className="text-xs text-matos-muted">Channels</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {CHANNELS.map((ch) => {
                  const on = channels.includes(ch);
                  return (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => toggleChannel(ch)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] ${
                        on
                          ? "border-matos-citron bg-[rgba(214,243,31,0.14)] text-matos-text"
                          : "border-matos-border text-matos-muted hover:text-matos-text"
                      }`}
                    >
                      {ch}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {error ? (
            <p className="mt-3 text-xs text-matos-danger">{error}</p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={
                busy ||
                !topic.trim() ||
                !audience.trim() ||
                !offerCta.trim() ||
                channels.length === 0
              }
              onClick={createBrief}
            >
              {busy ? "Creating…" : "Create job"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {DESK_STAGES.map((stage) => (
          <div
            key={stage}
            className="min-h-[220px] rounded-xl border border-matos-border bg-matos-elev"
          >
            <div className="border-b border-matos-soft px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-[13px] tracking-tight">
                  {STAGE_LABELS[stage]}
                </strong>
                <span className="font-mono text-[10px] text-matos-muted2">
                  {byStage[stage].length}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-matos-muted2">
                {STAGE_BLURBS[stage]}
              </p>
            </div>
            <div className="flex flex-col gap-2 p-2">
              {byStage[stage].length === 0 ? (
                <p className="px-1 py-3 text-[11px] text-matos-muted2">Empty</p>
              ) : (
                byStage[stage].map((job) => (
                  <Link
                    key={job.id}
                    href={`/desk/${job.id}`}
                    className="rounded-lg border border-matos-border bg-matos-panel p-2.5 transition-colors hover:border-matos-citron"
                  >
                    <div className="text-[12px] font-medium leading-snug text-matos-text">
                      {job.title}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone={statusTone(job.status)}>
                        {job.status.replaceAll("_", " ")}
                      </Badge>
                      <span className="text-[10px] text-matos-muted2">
                        {job.channels.join(" · ")}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
