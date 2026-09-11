import { parseJsonArray, prisma } from "@matos/db";
import { appendActivity } from "@/lib/map-data";
import { recordUsageEvent } from "@/lib/ops/usage";
import { getDeskProvider } from "./provider";
import {
  DESK_STAGES,
  STAGE_LABELS,
  isDeskStage,
  nextStage,
  previousStage,
  type DeskArtifactReview,
  type DeskInboxStatus,
  type DeskJobStatus,
  type DeskStage,
} from "./stages";

export * from "./stages";
export * from "./provider";

export type DeskArtifactDTO = {
  id: string;
  jobId: string;
  stage: DeskStage;
  title: string;
  body: string;
  reviewState: DeskArtifactReview;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
};

export type DeskCalendarItemDTO = {
  id: string;
  jobId: string;
  jobTitle?: string;
  channel: string;
  title: string;
  body: string;
  scheduledAt: string;
  status: string;
  createdAt: string;
};

export type DeskInboxItemDTO = {
  id: string;
  jobId: string;
  jobTitle?: string;
  channel: string;
  subject: string;
  body: string;
  status: DeskInboxStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  copiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeskJobDTO = {
  id: string;
  title: string;
  topic: string;
  audience: string;
  offerCta: string;
  channels: string[];
  dueAt: string | null;
  stage: DeskStage | "filed";
  status: DeskJobStatus;
  createdBy: string;
  filedAt: string | null;
  createdAt: string;
  updatedAt: string;
  artifacts: DeskArtifactDTO[];
  calendarItems: DeskCalendarItemDTO[];
  inboxItems: DeskInboxItemDTO[];
};

function asJobStatus(v: string): DeskJobStatus {
  if (
    v === "draft" ||
    v === "generating" ||
    v === "awaiting_approval" ||
    v === "changes_requested" ||
    v === "approved" ||
    v === "filed"
  ) {
    return v;
  }
  return "draft";
}

function asReview(v: string): DeskArtifactReview {
  if (
    v === "pending" ||
    v === "ready" ||
    v === "approved" ||
    v === "changes_requested"
  ) {
    return v;
  }
  return "pending";
}

function asInboxStatus(v: string): DeskInboxStatus {
  if (v === "drafted" || v === "approved" || v === "copied") return v;
  return "drafted";
}

function asJobStage(v: string): DeskStage | "filed" {
  if (v === "filed") return "filed";
  if (isDeskStage(v)) return v;
  return "scout";
}

type JobWithRelations = {
  id: string;
  title: string;
  topic: string;
  audience: string;
  offerCta: string;
  channelsJson: string;
  dueAt: Date | null;
  stage: string;
  status: string;
  createdBy: string;
  filedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  artifacts: {
    id: string;
    jobId: string;
    stage: string;
    title: string;
    body: string;
    reviewState: string;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    reviewNote: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  calendarItems: {
    id: string;
    jobId: string;
    channel: string;
    title: string;
    body: string;
    scheduledAt: Date;
    status: string;
    createdAt: Date;
  }[];
  inboxItems: {
    id: string;
    jobId: string;
    channel: string;
    subject: string;
    body: string;
    status: string;
    approvedBy: string | null;
    approvedAt: Date | null;
    copiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
};

export function toDeskJobDTO(job: JobWithRelations): DeskJobDTO {
  return {
    id: job.id,
    title: job.title,
    topic: job.topic,
    audience: job.audience,
    offerCta: job.offerCta,
    channels: parseJsonArray(job.channelsJson),
    dueAt: job.dueAt?.toISOString() ?? null,
    stage: asJobStage(job.stage),
    status: asJobStatus(job.status),
    createdBy: job.createdBy,
    filedAt: job.filedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    artifacts: job.artifacts
      .slice()
      .sort(
        (a, b) =>
          DESK_STAGES.indexOf(a.stage as DeskStage) -
          DESK_STAGES.indexOf(b.stage as DeskStage),
      )
      .map((a) => ({
        id: a.id,
        jobId: a.jobId,
        stage: (isDeskStage(a.stage) ? a.stage : "scout") as DeskStage,
        title: a.title,
        body: a.body,
        reviewState: asReview(a.reviewState),
        reviewedBy: a.reviewedBy,
        reviewedAt: a.reviewedAt?.toISOString() ?? null,
        reviewNote: a.reviewNote,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    calendarItems: job.calendarItems
      .slice()
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
      .map((c) => ({
        id: c.id,
        jobId: c.jobId,
        channel: c.channel,
        title: c.title,
        body: c.body,
        scheduledAt: c.scheduledAt.toISOString(),
        status: c.status,
        createdAt: c.createdAt.toISOString(),
      })),
    inboxItems: job.inboxItems
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((i) => ({
        id: i.id,
        jobId: i.jobId,
        channel: i.channel,
        subject: i.subject,
        body: i.body,
        status: asInboxStatus(i.status),
        approvedBy: i.approvedBy,
        approvedAt: i.approvedAt?.toISOString() ?? null,
        copiedAt: i.copiedAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
  };
}

const jobInclude = {
  artifacts: true,
  calendarItems: true,
  inboxItems: true,
} as const;

export async function listDeskJobs(opts?: {
  filedOnly?: boolean;
}): Promise<DeskJobDTO[]> {
  const rows = await prisma.deskJob.findMany({
    where: opts?.filedOnly
      ? { stage: "filed" }
      : { NOT: { stage: "filed" } },
    include: jobInclude,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toDeskJobDTO);
}

export async function listFiledDeskJobs(): Promise<DeskJobDTO[]> {
  return listDeskJobs({ filedOnly: true });
}

export async function getDeskJob(id: string): Promise<DeskJobDTO | null> {
  const row = await prisma.deskJob.findUnique({
    where: { id },
    include: jobInclude,
  });
  return row ? toDeskJobDTO(row) : null;
}

export async function createDeskJob(input: {
  title?: string;
  topic: string;
  audience: string;
  offerCta: string;
  channels: string[];
  dueAt?: string | null;
  actorEmail: string;
}): Promise<DeskJobDTO> {
  const title =
    input.title?.trim() ||
    input.topic.trim().slice(0, 80) ||
    "Untitled desk brief";
  const job = await prisma.deskJob.create({
    data: {
      title,
      topic: input.topic.trim(),
      audience: input.audience.trim(),
      offerCta: input.offerCta.trim(),
      channelsJson: JSON.stringify(input.channels),
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      stage: "scout",
      status: "draft",
      createdBy: input.actorEmail,
    },
    include: jobInclude,
  });

  await appendActivity({
    action: "desk.brief.create",
    entityType: "desk_job",
    entityId: job.id,
    summary: `Desk brief created: ${job.title}`,
    actorEmail: input.actorEmail,
    payload: { channels: input.channels, topic: job.topic },
  });
  await recordUsageEvent({
    userId: input.actorEmail,
    kind: "api_hit",
    units: 1,
    meta: { desk: "brief.create", jobId: job.id },
    activity: false,
  });

  return toDeskJobDTO(job);
}

/**
 * Generate (or regenerate) the artifact for the job's current stage.
 * Cannot run a later stage until the prior artifact is approved.
 */
export async function runDeskStage(input: {
  jobId: string;
  actorEmail: string;
}): Promise<DeskJobDTO> {
  const job = await prisma.deskJob.findUnique({
    where: { id: input.jobId },
    include: jobInclude,
  });
  if (!job) throw new Error("Desk job not found");
  if (job.stage === "filed") throw new Error("Job already filed");
  if (!isDeskStage(job.stage)) throw new Error("Invalid job stage");

  const stage = job.stage;
  const prev = previousStage(stage);
  if (prev) {
    const prevArt = job.artifacts.find((a) => a.stage === prev);
    if (!prevArt || prevArt.reviewState !== "approved") {
      throw new Error(
        `Cannot run ${STAGE_LABELS[stage]} until ${STAGE_LABELS[prev]} is approved`,
      );
    }
  }

  await prisma.deskJob.update({
    where: { id: job.id },
    data: { status: "generating" },
  });

  const provider = getDeskProvider();
  const channels = parseJsonArray(job.channelsJson);
  const generated = await provider.generate({
    stage,
    brief: {
      title: job.title,
      topic: job.topic,
      audience: job.audience,
      offerCta: job.offerCta,
      channels,
      dueAt: job.dueAt?.toISOString() ?? null,
    },
    priorArtifacts: job.artifacts.map((a) => ({
      stage: a.stage,
      title: a.title,
      body: a.body,
    })),
  });

  const existing = job.artifacts.find((a) => a.stage === stage);
  if (existing) {
    await prisma.deskStageArtifact.update({
      where: { id: existing.id },
      data: {
        title: generated.title,
        body: generated.body,
        reviewState: "ready",
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: "",
      },
    });
  } else {
    await prisma.deskStageArtifact.create({
      data: {
        jobId: job.id,
        stage,
        title: generated.title,
        body: generated.body,
        reviewState: "ready",
      },
    });
  }

  const updated = await prisma.deskJob.update({
    where: { id: job.id },
    data: { status: "awaiting_approval" },
    include: jobInclude,
  });

  await appendActivity({
    action: "desk.stage.run",
    entityType: "desk_job",
    entityId: job.id,
    summary: `Desk ${STAGE_LABELS[stage]} generated for ${job.title}`,
    actorEmail: input.actorEmail,
    payload: { stage, provider: generated.meta.provider },
  });
  await recordUsageEvent({
    userId: input.actorEmail,
    kind: "ai_credit",
    units: 1,
    meta: {
      desk: "stage.run",
      stage,
      jobId: job.id,
      provider: generated.meta.provider,
    },
  });

  return toDeskJobDTO(updated);
}

export async function updateDeskArtifact(input: {
  jobId: string;
  body: string;
  title?: string;
  actorEmail: string;
}): Promise<DeskJobDTO> {
  const job = await prisma.deskJob.findUnique({
    where: { id: input.jobId },
    include: jobInclude,
  });
  if (!job) throw new Error("Desk job not found");
  if (job.stage === "filed") throw new Error("Job already filed");
  if (!isDeskStage(job.stage)) throw new Error("Invalid job stage");

  const art = job.artifacts.find((a) => a.stage === job.stage);
  if (!art) throw new Error("No artifact for current stage — run the stage first");

  await prisma.deskStageArtifact.update({
    where: { id: art.id },
    data: {
      body: input.body,
      ...(input.title ? { title: input.title } : {}),
      reviewState:
        art.reviewState === "approved" ? "ready" : art.reviewState === "pending"
          ? "ready"
          : art.reviewState === "changes_requested"
            ? "ready"
            : "ready",
      reviewedBy: null,
      reviewedAt: null,
    },
  });

  const updated = await prisma.deskJob.update({
    where: { id: job.id },
    data: { status: "awaiting_approval" },
    include: jobInclude,
  });

  await appendActivity({
    action: "desk.artifact.edit",
    entityType: "desk_job",
    entityId: job.id,
    summary: `Edited ${STAGE_LABELS[job.stage]} artifact on ${job.title}`,
    actorEmail: input.actorEmail,
    payload: { stage: job.stage },
  });

  return toDeskJobDTO(updated);
}

async function materializeClock(jobId: string, channels: string[], dueAt: Date | null) {
  await prisma.deskCalendarItem.deleteMany({ where: { jobId } });
  const base = dueAt ? new Date(dueAt) : new Date(Date.now() + 2 * 86400000);
  const job = await prisma.deskJob.findUniqueOrThrow({ where: { id: jobId } });
  for (let i = 0; i < channels.length; i++) {
    const when = new Date(base.getTime() + i * 86400000);
    await prisma.deskCalendarItem.create({
      data: {
        jobId,
        channel: channels[i]!,
        title: `${job.title} · ${channels[i]}`,
        body: `Scheduled pack for ${channels[i]} (planned — no live publish).`,
        scheduledAt: when,
        status: "planned",
      },
    });
  }
}

async function materializeEcho(jobId: string, channels: string[]) {
  await prisma.deskInboxItem.deleteMany({ where: { jobId } });
  const job = await prisma.deskJob.findUniqueOrThrow({
    where: { id: jobId },
    include: { artifacts: true },
  });
  const echo = job.artifacts.find((a) => a.stage === "echo");
  const channel = channels[0] ?? "general";
  const drafts = [
    {
      subject: `Re: ${job.topic} (curious)`,
      body:
        echo?.body.split("## Reply A")[1]?.split("## Reply B")[0]?.trim() ||
        `Thanks for reading — ${job.offerCta}`,
    },
    {
      subject: `Re: ${job.topic} (skeptical)`,
      body:
        echo?.body.split("## Reply B")[1]?.split("## Reply C")[0]?.trim() ||
        `Gates keep Operators in control. Nothing auto-publishes.`,
    },
    {
      subject: `Re: ${job.topic} (ready)`,
      body:
        echo?.body.split("## Reply C")[1]?.trim() ||
        `Open Desk and run the brief. ${job.offerCta}`,
    },
  ];
  for (const d of drafts) {
    await prisma.deskInboxItem.create({
      data: {
        jobId,
        channel,
        subject: d.subject,
        body: d.body,
        status: "drafted",
      },
    });
  }
}

/**
 * Approve or request changes on the current stage artifact.
 * Approve advances to the next stage (or files the job after Echo).
 * Skipping ahead is rejected.
 */
export async function reviewDeskStage(input: {
  jobId: string;
  action: "approve" | "request_changes";
  note?: string;
  actorEmail: string;
}): Promise<DeskJobDTO> {
  const job = await prisma.deskJob.findUnique({
    where: { id: input.jobId },
    include: jobInclude,
  });
  if (!job) throw new Error("Desk job not found");
  if (job.stage === "filed") throw new Error("Job already filed");
  if (!isDeskStage(job.stage)) throw new Error("Invalid job stage");

  const stage = job.stage;
  const art = job.artifacts.find((a) => a.stage === stage);
  if (!art || (art.reviewState !== "ready" && art.reviewState !== "changes_requested")) {
    throw new Error("Current stage has no ready artifact to review");
  }

  if (input.action === "request_changes") {
    await prisma.deskStageArtifact.update({
      where: { id: art.id },
      data: {
        reviewState: "changes_requested",
        reviewedBy: input.actorEmail,
        reviewedAt: new Date(),
        reviewNote: input.note ?? "",
      },
    });
    const updated = await prisma.deskJob.update({
      where: { id: job.id },
      data: { status: "changes_requested" },
      include: jobInclude,
    });
    await appendActivity({
      action: "desk.stage.changes",
      entityType: "desk_job",
      entityId: job.id,
      summary: `Changes requested on ${STAGE_LABELS[stage]} — ${job.title}`,
      actorEmail: input.actorEmail,
      payload: { stage, note: input.note ?? "" },
    });
    return toDeskJobDTO(updated);
  }

  // approve
  await prisma.deskStageArtifact.update({
    where: { id: art.id },
    data: {
      reviewState: "approved",
      reviewedBy: input.actorEmail,
      reviewedAt: new Date(),
      reviewNote: input.note ?? "",
    },
  });

  const channels = parseJsonArray(job.channelsJson);

  if (stage === "clock") {
    await materializeClock(job.id, channels, job.dueAt);
  }
  if (stage === "echo") {
    // Ensure echo artifact is approved before materializing inbox
    await materializeEcho(job.id, channels);
  }

  const nxt = nextStage(stage);
  if (nxt === "filed") {
    const updated = await prisma.deskJob.update({
      where: { id: job.id },
      data: {
        stage: "filed",
        status: "filed",
        filedAt: new Date(),
      },
      include: jobInclude,
    });
    await appendActivity({
      action: "desk.job.filed",
      entityType: "desk_job",
      entityId: job.id,
      summary: `Desk job filed to Library: ${job.title}`,
      actorEmail: input.actorEmail,
      payload: { stage },
    });
    return toDeskJobDTO(updated);
  }

  const updated = await prisma.deskJob.update({
    where: { id: job.id },
    data: {
      stage: nxt,
      status: "draft",
    },
    include: jobInclude,
  });

  await appendActivity({
    action: "desk.stage.approve",
    entityType: "desk_job",
    entityId: job.id,
    summary: `Approved ${STAGE_LABELS[stage]} → ${STAGE_LABELS[nxt]} on ${job.title}`,
    actorEmail: input.actorEmail,
    payload: { from: stage, to: nxt },
  });

  return toDeskJobDTO(updated);
}

export async function listCalendarItems(): Promise<DeskCalendarItemDTO[]> {
  const rows = await prisma.deskCalendarItem.findMany({
    include: { job: { select: { title: true } } },
    orderBy: { scheduledAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    jobTitle: r.job.title,
    channel: r.channel,
    title: r.title,
    body: r.body,
    scheduledAt: r.scheduledAt.toISOString(),
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function listInboxItems(): Promise<DeskInboxItemDTO[]> {
  const rows = await prisma.deskInboxItem.findMany({
    include: { job: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    jobId: r.jobId,
    jobTitle: r.job.title,
    channel: r.channel,
    subject: r.subject,
    body: r.body,
    status: asInboxStatus(r.status),
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    copiedAt: r.copiedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/**
 * Inbox sending stays gated — only approve or mark copied.
 * There is no live network send in Phase 5.5.
 */
export async function actOnInboxItem(input: {
  id: string;
  action: "approve" | "copied";
  actorEmail: string;
}): Promise<DeskInboxItemDTO> {
  const row = await prisma.deskInboxItem.findUnique({
    where: { id: input.id },
    include: { job: { select: { title: true } } },
  });
  if (!row) throw new Error("Inbox item not found");

  if (input.action === "approve") {
    const updated = await prisma.deskInboxItem.update({
      where: { id: row.id },
      data: {
        status: "approved",
        approvedBy: input.actorEmail,
        approvedAt: new Date(),
      },
      include: { job: { select: { title: true } } },
    });
    await appendActivity({
      action: "desk.inbox.approve",
      entityType: "desk_inbox",
      entityId: row.id,
      summary: `Inbox draft approved (not sent): ${row.subject}`,
      actorEmail: input.actorEmail,
      payload: { jobId: row.jobId },
    });
    return {
      id: updated.id,
      jobId: updated.jobId,
      jobTitle: updated.job.title,
      channel: updated.channel,
      subject: updated.subject,
      body: updated.body,
      status: asInboxStatus(updated.status),
      approvedBy: updated.approvedBy,
      approvedAt: updated.approvedAt?.toISOString() ?? null,
      copiedAt: updated.copiedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  const updated = await prisma.deskInboxItem.update({
    where: { id: row.id },
    data: {
      status: "copied",
      copiedAt: new Date(),
      ...(row.status === "drafted"
        ? { approvedBy: input.actorEmail, approvedAt: new Date() }
        : {}),
    },
    include: { job: { select: { title: true } } },
  });
  await appendActivity({
    action: "desk.inbox.copied",
    entityType: "desk_inbox",
    entityId: row.id,
    summary: `Inbox draft marked copied (not sent): ${row.subject}`,
    actorEmail: input.actorEmail,
    payload: { jobId: row.jobId },
  });
  return {
    id: updated.id,
    jobId: updated.jobId,
    jobTitle: updated.job.title,
    channel: updated.channel,
    subject: updated.subject,
    body: updated.body,
    status: asInboxStatus(updated.status),
    approvedBy: updated.approvedBy,
    approvedAt: updated.approvedAt?.toISOString() ?? null,
    copiedAt: updated.copiedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}
