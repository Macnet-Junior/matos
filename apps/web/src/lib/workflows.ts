import {
  parseJsonArray,
  parseJsonObject,
  prisma,
  type Skill,
  type Workflow,
  type WorkflowRun,
  type WorkflowStep,
  type RunStep,
} from "@matos/db";
import type {
  ContentGate,
  RunStepDTO,
  RunStepStatus,
  SkillStatus,
  ReviewGate,
  WorkflowDTO,
  WorkflowRunDTO,
  WorkflowRunStatus,
  WorkflowRunSummaryDTO,
  WorkflowStepDTO,
  HomeDigestDTO,
  ChannelStubDTO,
} from "./types";
import { toActivityDTO } from "./map-data";
import {
  GATE_ORDER,
  canAdvanceGate,
  canSimulatePublish,
  isPublishSkill,
} from "./workflows-client";

export function asContentGate(value: string): ContentGate {
  if (
    value === "draft" ||
    value === "warm" ||
    value === "approved" ||
    value === "scheduled" ||
    value === "published"
  ) {
    return value;
  }
  return "draft";
}

export function gateIndex(gate: ContentGate): number {
  return GATE_ORDER.indexOf(gate);
}


function asRunStatus(value: string): WorkflowRunStatus {
  if (
    value === "running" ||
    value === "completed" ||
    value === "failed" ||
    value === "blocked"
  ) {
    return value;
  }
  return "failed";
}

function asStepStatus(value: string): RunStepStatus {
  if (
    value === "pending" ||
    value === "running" ||
    value === "completed" ||
    value === "skipped" ||
    value === "blocked"
  ) {
    return value;
  }
  return "pending";
}

function asSkillStatus(value: string): SkillStatus {
  if (value === "authored" || value === "planned" || value === "missing") {
    return value;
  }
  return "planned";
}

function asReviewGate(value: string): ReviewGate {
  if (value === "Cold" || value === "Warm" || value === "Hot") return value;
  return "Warm";
}

type StepWithSkill = WorkflowStep & { skill: Skill };
type WorkflowWithSteps = Workflow & { steps: StepWithSkill[] };

export function toWorkflowStepDTO(step: StepWithSkill): WorkflowStepDTO {
  return {
    id: step.id,
    workflowId: step.workflowId,
    skillId: step.skillId,
    skillSlug: step.skill.slug,
    skillTitle: step.skill.title,
    skillStatus: asSkillStatus(step.skill.status),
    skillReviewGate: asReviewGate(step.skill.reviewGate),
    sortOrder: step.sortOrder,
    label: step.label,
  };
}

export function toWorkflowDTO(
  wf: WorkflowWithSteps,
  extras?: {
    runCount?: number;
    lastRun?: WorkflowRunSummaryDTO | null;
  },
): WorkflowDTO {
  return {
    id: wf.id,
    slug: wf.slug,
    name: wf.name,
    description: wf.description,
    gateState: asContentGate(wf.gateState),
    steps: wf.steps
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toWorkflowStepDTO),
    createdAt: wf.createdAt.toISOString(),
    updatedAt: wf.updatedAt.toISOString(),
    runCount: extras?.runCount,
    lastRun: extras?.lastRun ?? null,
  };
}

export function toRunSummaryDTO(
  run: WorkflowRun,
  workflowName?: string,
): WorkflowRunSummaryDTO {
  return {
    id: run.id,
    workflowId: run.workflowId,
    workflowName,
    status: asRunStatus(run.status),
    gateState: asContentGate(run.gateState),
    dryRun: run.dryRun,
    summary: run.summary,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    actorEmail: run.actorEmail,
  };
}

export function toRunStepDTO(step: RunStep): RunStepDTO {
  let logs: unknown[] = [];
  try {
    const parsed = JSON.parse(step.logJson) as unknown;
    logs = Array.isArray(parsed) ? parsed : [];
  } catch {
    logs = [];
  }
  return {
    id: step.id,
    runId: step.runId,
    workflowStepId: step.workflowStepId,
    skillId: step.skillId,
    skillSlug: step.skillSlug,
    skillTitle: step.skillTitle,
    sortOrder: step.sortOrder,
    status: asStepStatus(step.status),
    gateState: asContentGate(step.gateState),
    logs,
    artifact: parseJsonObject(step.artifactJson),
    startedAt: step.startedAt?.toISOString() ?? null,
    finishedAt: step.finishedAt?.toISOString() ?? null,
  };
}

export function toRunDTO(
  run: WorkflowRun & { steps: RunStep[]; workflow?: Workflow },
): WorkflowRunDTO {
  return {
    ...toRunSummaryDTO(run, run.workflow?.name),
    workflowSlug: run.workflow?.slug,
    artifact: parseJsonObject(run.artifactJson),
    steps: run.steps
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(toRunStepDTO),
  };
}

const workflowInclude = {
  steps: {
    include: { skill: true },
    orderBy: { sortOrder: "asc" as const },
  },
};

export async function listWorkflows(): Promise<WorkflowDTO[]> {
  const rows = await prisma.workflow.findMany({
    include: workflowInclude,
    orderBy: { name: "asc" },
  });
  const result: WorkflowDTO[] = [];
  for (const wf of rows) {
    const runCount = await prisma.workflowRun.count({
      where: { workflowId: wf.id },
    });
    const last = await prisma.workflowRun.findFirst({
      where: { workflowId: wf.id },
      orderBy: { startedAt: "desc" },
    });
    result.push(
      toWorkflowDTO(wf, {
        runCount,
        lastRun: last ? toRunSummaryDTO(last, wf.name) : null,
      }),
    );
  }
  return result;
}

export async function getWorkflow(id: string): Promise<WorkflowDTO | null> {
  const wf = await prisma.workflow.findUnique({
    where: { id },
    include: workflowInclude,
  });
  if (!wf) return null;
  const runCount = await prisma.workflowRun.count({
    where: { workflowId: wf.id },
  });
  const last = await prisma.workflowRun.findFirst({
    where: { workflowId: wf.id },
    orderBy: { startedAt: "desc" },
  });
  return toWorkflowDTO(wf, {
    runCount,
    lastRun: last ? toRunSummaryDTO(last, wf.name) : null,
  });
}

export async function getWorkflowBySlug(
  slug: string,
): Promise<WorkflowDTO | null> {
  const wf = await prisma.workflow.findUnique({
    where: { slug },
    include: workflowInclude,
  });
  if (!wf) return null;
  return toWorkflowDTO(wf);
}

function buildDryArtifact(skill: Skill, gate: ContentGate) {
  const steps = parseJsonArray(skill.stepsJson);
  return {
    kind: "dry-run-artifact",
    skillSlug: skill.slug,
    skillTitle: skill.title,
    purpose: skill.purpose,
    instructionsPreview: skill.instructions.slice(0, 280),
    skillSteps: steps,
    reviewGateRequired: skill.reviewGate,
    contentGate: gate,
    generatedAt: new Date().toISOString(),
    note: "Simulated output — no external posts",
  };
}

/**
 * Execute a workflow as a dry-run: create run + step through skills,
 * write JSON logs/artifacts, never post externally.
 * Publish-oriented skills are blocked unless the run gate is approved+.
 */
export async function executeDryRun(input: {
  workflowId: string;
  actorEmail?: string | null;
  /** Override starting gate; defaults to workflow.gateState */
  gateState?: ContentGate;
}): Promise<WorkflowRunDTO> {
  const wf = await prisma.workflow.findUnique({
    where: { id: input.workflowId },
    include: workflowInclude,
  });
  if (!wf) {
    throw new Error("Workflow not found");
  }
  if (wf.steps.length === 0) {
    throw new Error("Workflow has no steps");
  }

  // Each dry-run starts at draft unless the caller overrides.
  const gate = input.gateState ?? "draft";
  const startedAt = new Date();

  const run = await prisma.workflowRun.create({
    data: {
      workflowId: wf.id,
      status: "running",
      gateState: gate,
      dryRun: true,
      summary: `Dry-run started for ${wf.name}`,
      artifactJson: JSON.stringify({
        workflowSlug: wf.slug,
        mode: "dry-run",
      }),
      startedAt,
      actorEmail: input.actorEmail ?? null,
    },
  });

  const ordered = wf.steps
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  let blockedCount = 0;
  const stepArtifacts: Record<string, unknown>[] = [];

  for (const step of ordered) {
    const now = new Date();
    const logs: unknown[] = [
      {
        t: now.toISOString(),
        level: "info",
        message: `Starting skill ${step.skill.slug}`,
      },
    ];

    const publishIntent = isPublishSkill(step.skill.slug);
    if (publishIntent && !canSimulatePublish(gate)) {
      logs.push({
        t: new Date().toISOString(),
        level: "warn",
        message: `Blocked publish skill — gate is ${gate}; need approved before simulated publish`,
      });
      const blocked = await prisma.runStep.create({
        data: {
          runId: run.id,
          workflowStepId: step.id,
          skillId: step.skillId,
          skillSlug: step.skill.slug,
          skillTitle: step.skill.title,
          sortOrder: step.sortOrder,
          status: "blocked",
          gateState: gate,
          logJson: JSON.stringify(logs),
          artifactJson: JSON.stringify({
            blocked: true,
            reason: "publish_requires_approved",
            gate,
          }),
          startedAt: now,
          finishedAt: new Date(),
        },
      });
      stepArtifacts.push(toRunStepDTO(blocked).artifact);
      blockedCount += 1;
      continue;
    }

    const artifact = buildDryArtifact(step.skill, gate);
    if (publishIntent) {
      logs.push({
        t: new Date().toISOString(),
        level: "info",
        message:
          "Simulated publish artifact written (no external API call)",
      });
      Object.assign(artifact, {
        simulatedPublish: true,
        channels: [],
        externalPost: false,
      });
    } else {
      logs.push({
        t: new Date().toISOString(),
        level: "info",
        message: `Dry artifact generated for ${step.skill.title}`,
      });
    }

    const created = await prisma.runStep.create({
      data: {
        runId: run.id,
        workflowStepId: step.id,
        skillId: step.skillId,
        skillSlug: step.skill.slug,
        skillTitle: step.skill.title,
        sortOrder: step.sortOrder,
        status: "completed",
        gateState: gate,
        logJson: JSON.stringify(logs),
        artifactJson: JSON.stringify(artifact),
        startedAt: now,
        finishedAt: new Date(),
      },
    });
    stepArtifacts.push(toRunStepDTO(created).artifact);
  }

  const finishedAt = new Date();
  const status: WorkflowRunStatus =
    blockedCount > 0 && blockedCount === ordered.length
      ? "blocked"
      : blockedCount > 0
        ? "completed"
        : "completed";

  const summary =
    blockedCount > 0
      ? `Dry-run finished with ${blockedCount} blocked publish step(s) — approve gate to simulate publish`
      : `Dry-run completed ${ordered.length} step(s) for ${wf.name}`;

  const updated = await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      status,
      summary,
      finishedAt,
      artifactJson: JSON.stringify({
        workflowSlug: wf.slug,
        mode: "dry-run",
        stepCount: ordered.length,
        blockedCount,
        gate,
        steps: stepArtifacts,
      }),
    },
    include: {
      steps: true,
      workflow: true,
    },
  });

  return toRunDTO(updated);
}

export async function getRun(runId: string): Promise<WorkflowRunDTO | null> {
  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    include: { steps: true, workflow: true },
  });
  if (!run) return null;
  return toRunDTO(run);
}

export async function advanceRunGate(input: {
  runId: string;
  to: ContentGate;
  actorEmail?: string | null;
}): Promise<WorkflowRunDTO> {
  const run = await prisma.workflowRun.findUnique({
    where: { id: input.runId },
    include: { steps: true, workflow: true },
  });
  if (!run) {
    throw new Error("Run not found");
  }
  const from = asContentGate(run.gateState);
  const check = canAdvanceGate(from, input.to);
  if (!check.ok) {
    throw new Error(check.error);
  }

  const updated = await prisma.workflowRun.update({
    where: { id: run.id },
    data: {
      gateState: input.to,
      summary:
        input.to === "published"
          ? `${run.summary} · Simulated publish (no external posts)`
          : run.summary,
      artifactJson: JSON.stringify({
        ...parseJsonObject(run.artifactJson),
        gateHistory: [
          ...((parseJsonObject(run.artifactJson).gateHistory as unknown[]) ??
            []),
          {
            from,
            to: input.to,
            at: new Date().toISOString(),
            actorEmail: input.actorEmail ?? null,
            simulated:
              input.to === "published" || input.to === "scheduled",
          },
        ],
      }),
    },
    include: { steps: true, workflow: true },
  });

  // Mirror gate onto run steps for UI clarity
  await prisma.runStep.updateMany({
    where: { runId: run.id },
    data: { gateState: input.to },
  });

  const refreshed = await prisma.workflowRun.findUniqueOrThrow({
    where: { id: updated.id },
    include: { steps: true, workflow: true },
  });
  return toRunDTO(refreshed);
}

export async function advanceWorkflowGate(input: {
  workflowId: string;
  to: ContentGate;
}): Promise<WorkflowDTO> {
  const wf = await prisma.workflow.findUnique({
    where: { id: input.workflowId },
    include: workflowInclude,
  });
  if (!wf) {
    throw new Error("Workflow not found");
  }
  const from = asContentGate(wf.gateState);
  const check = canAdvanceGate(from, input.to);
  if (!check.ok) {
    throw new Error(check.error);
  }
  const updated = await prisma.workflow.update({
    where: { id: wf.id },
    data: { gateState: input.to },
    include: workflowInclude,
  });
  return toWorkflowDTO(updated);
}

export async function loadHomeDigest(): Promise<HomeDigestDTO> {
  const workflows = await prisma.workflow.findMany({
    orderBy: { updatedAt: "desc" },
  });
  const pendingWorkflows = workflows.filter((w) => {
    const g = asContentGate(w.gateState);
    return g === "draft" || g === "warm";
  });

  const pendingRuns = await prisma.workflowRun.findMany({
    where: { gateState: { in: ["draft", "warm"] } },
    include: { workflow: true },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  const pendingGates: HomeDigestDTO["pendingGates"] = [
    ...pendingWorkflows.map((w) => ({
      kind: "workflow" as const,
      id: w.id,
      name: w.name,
      gateState: asContentGate(w.gateState),
      href: `/workflows/${w.id}`,
    })),
    ...pendingRuns.map((r) => ({
      kind: "run" as const,
      id: r.id,
      name: `${r.workflow.name} · run`,
      gateState: asContentGate(r.gateState),
      href: `/workflows/runs/${r.id}`,
    })),
  ];

  const activity = await prisma.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  const lastRunRow = await prisma.workflowRun.findFirst({
    orderBy: { startedAt: "desc" },
    include: { workflow: true },
  });

  return {
    pendingGates,
    recentActivity: activity.map(toActivityDTO),
    lastRun: lastRunRow
      ? toRunSummaryDTO(lastRunRow, lastRunRow.workflow.name)
      : null,
    workflowCount: await prisma.workflow.count(),
    runCount: await prisma.workflowRun.count(),
  };
}

export function channelStubs(): ChannelStubDTO[] {
  return [
    {
      id: "late-dev",
      name: "Late.dev",
      status: "disconnected",
      note: "Social publishing partner. OAuth + schedule API land in Phase 4.",
      phase: "Connect in Phase 4",
    },
    {
      id: "etsy",
      name: "Etsy",
      status: "disconnected",
      note: "Listing drafts stay local. Live marketplace API deferred to Phase 4.",
      phase: "Connect in Phase 4",
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      status: "disconnected",
      note: "When live later: only group Career path and content creation monetization — no broad broadcast automation.",
      phase: "Connect in Phase 4",
    },
  ];
}

export { GATE_ORDER, canAdvanceGate, canSimulatePublish, isPublishSkill } from "./workflows-client";
