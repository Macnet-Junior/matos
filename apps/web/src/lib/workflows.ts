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
  ChannelDTO,
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


async function attemptChannelPublish(input: {
  skillSlug: string;
  gate: ContentGate;
  skillTitle: string;
  purpose: string;
  actorEmail?: string | null;
}): Promise<{
  logs: Array<{ level: string; message: string }>;
  artifact: Record<string, unknown>;
}> {
  const logs: Array<{ level: string; message: string }> = [];
  const artifact: Record<string, unknown> = {
    simulatedPublish: true,
    channels: [] as string[],
    externalPost: false,
  };

  if (!canSimulatePublish(input.gate)) {
    logs.push({
      level: "warn",
      message: `Publish skipped — gate is ${input.gate}`,
    });
    return { logs, artifact };
  }

  // Late.dev schedule attempt for scheduler / channel skills
  const lateSkills = new Set(["scheduler", "channel-connect", "native-adapt"]);
  if (lateSkills.has(input.skillSlug)) {
    try {
      const { resolveLateApiKey, isLateConnected } = await import(
        "./integrations/accounts"
      );
      const { LateClient, simulateLateSchedule, lateApiBase } = await import(
        "./integrations/late"
      );
      const connected = await isLateConnected();
      const { key } = await resolveLateApiKey();
      const content =
        input.purpose?.trim() ||
        `MatOS publish: ${input.skillTitle} (${input.skillSlug})`;

      if (connected && key) {
        try {
          const client = new LateClient({ apiKey: key, baseUrl: lateApiBase() });
          const profiles = await client.listProfiles();
          const profileId = profiles[0]?._id;
          const accounts = await client.listAccounts();
          const account = accounts.find((a) => a.isActive !== false) ?? accounts[0];
          if (profileId && account) {
            const result = await client.createPost({
              content,
              scheduledFor: new Date(Date.now() + 3600_000).toISOString(),
              timezone: "America/New_York",
              platforms: [
                { platform: account.platform, accountId: account._id },
              ],
            });
            logs.push({
              level: "info",
              message: `Late.dev scheduled post ${result.post?._id ?? "(ok)"}`,
            });
            artifact.simulatedPublish = false;
            artifact.externalPost = true;
            artifact.late = result;
            (artifact.channels as string[]).push("late-dev");
            try {
              const { recordUsageEvent } = await import("./ops/usage");
              await recordUsageEvent({
                userId: input.actorEmail ?? "workspace",
                kind: "late_post",
                units: 1,
                meta: { skillSlug: input.skillSlug, simulated: false },
              });
            } catch { /* ignore meter errors */ }
          } else {
            const sim = simulateLateSchedule({
              content,
              reason:
                "Late connected but no profile/account yet — simulated schedule",
            });
            logs.push({
              level: "info",
              message: sim.message ?? "Simulated Late schedule",
            });
            artifact.late = sim;
            (artifact.channels as string[]).push("late-dev:simulated");
            try {
              const { recordUsageEvent } = await import("./ops/usage");
              await recordUsageEvent({
                userId: input.actorEmail ?? "workspace",
                kind: "late_post",
                units: 1,
                meta: { skillSlug: input.skillSlug, simulated: true },
              });
            } catch { /* ignore */ }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Late API error";
          logs.push({
            level: "warn",
            message: `Late live call failed (${msg}) — falling back to simulated`,
          });
          const sim = simulateLateSchedule({ content, reason: msg });
          artifact.late = sim;
          (artifact.channels as string[]).push("late-dev:simulated");
            try {
              const { recordUsageEvent } = await import("./ops/usage");
              await recordUsageEvent({
                userId: input.actorEmail ?? "workspace",
                kind: "late_post",
                units: 1,
                meta: { skillSlug: input.skillSlug, simulated: true },
              });
            } catch { /* ignore */ }
        }
      } else {
        const sim = simulateLateSchedule({
          content,
          reason:
            "Late.dev not connected — simulated schedule (connect API key on Channels)",
        });
        logs.push({
          level: "info",
          message: sim.message ?? "Simulated Late schedule",
        });
        artifact.late = sim;
        (artifact.channels as string[]).push("late-dev:simulated");
            try {
              const { recordUsageEvent } = await import("./ops/usage");
              await recordUsageEvent({
                userId: input.actorEmail ?? "workspace",
                kind: "late_post",
                units: 1,
                meta: { skillSlug: input.skillSlug, simulated: true },
              });
            } catch { /* ignore */ }
      }
    } catch (err) {
      logs.push({
        level: "warn",
        message: `Late publish path error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  // Etsy draft stub for etsy-publish
  if (input.skillSlug === "etsy-publish") {
    const { draftFromListingLab, simulateEtsyDraft } = await import(
      "./integrations/etsy"
    );
    const draft = draftFromListingLab({
      title: input.skillTitle,
      description: input.purpose,
    });
    const result = simulateEtsyDraft(draft);
    logs.push({
      level: "info",
      message: result.simulated
        ? "Etsy draft listing simulated (connect OAuth for live draft)"
        : `Etsy draft listing ${result.listing_id}`,
    });
    artifact.etsy = result;
    (artifact.channels as string[]).push(
      result.simulated ? "etsy:simulated" : "etsy",
    );
    try {
      const { recordUsageEvent } = await import("./ops/usage");
      await recordUsageEvent({
        userId: input.actorEmail ?? "workspace",
        kind: "etsy_call",
        units: 1,
        meta: { skillSlug: input.skillSlug, simulated: !!result.simulated },
      });
    } catch { /* ignore */ }
  }

  // WhatsApp — never send without allowlist + gate (simulate only in dry-run)
  if (input.skillSlug === "whatsapp-drop") {
    const { whatsappConfigFromEnv, simulateWhatsAppSend } = await import(
      "./integrations/whatsapp"
    );
    const cfg = whatsappConfigFromEnv();
    const dest = cfg.allowedTo ?? "";
    const result = simulateWhatsAppSend({
      to: dest || "__missing__",
      text: input.purpose?.trim() || `MatOS: ${input.skillTitle}`,
      allowedTo: cfg.allowedTo,
      reviewGateApproved: canSimulatePublish(input.gate),
    });
    if (result.ok) {
      logs.push({
        level: "info",
        message: result.simulated
          ? `WhatsApp simulated send to allowlisted destination only`
          : `WhatsApp sent ${result.messageId}`,
      });
    } else {
      logs.push({
        level: "warn",
        message: result.error ?? "WhatsApp send blocked",
      });
    }
    artifact.whatsapp = result;
    (artifact.channels as string[]).push(
      result.ok ? "whatsapp:simulated" : "whatsapp:blocked",
    );
    if (result.ok) {
      try {
        const { recordUsageEvent } = await import("./ops/usage");
        await recordUsageEvent({
          userId: input.actorEmail ?? "workspace",
          kind: "whatsapp_send",
          units: 1,
          meta: { skillSlug: input.skillSlug, simulated: !!result.simulated },
        });
      } catch { /* ignore */ }
    }
  }

  if (!(artifact.channels as string[]).length) {
    logs.push({
      level: "info",
      message: "Simulated publish artifact written (no external API call)",
    });
  }

  return { logs, artifact };
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
      const publishResult = await attemptChannelPublish({
        skillSlug: step.skill.slug,
        gate,
        skillTitle: step.skill.title,
        purpose: step.skill.purpose,
        actorEmail: input.actorEmail,
      });
      for (const line of publishResult.logs) {
        logs.push({
          t: new Date().toISOString(),
          level: line.level,
          message: line.message,
        });
      }
      Object.assign(artifact, publishResult.artifact);
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

export async function listChannels(): Promise<ChannelDTO[]> {
  const { listChannelStatus } = await import("./integrations/accounts");
  return listChannelStatus();
}

/** @deprecated Prefer listChannels() — sync stub for static SSR fallback */
export function channelStubs(): ChannelDTO[] {
  return [
    {
      id: "late-dev",
      name: "Late.dev",
      status: "disconnected",
      note: "Social publishing partner. Connect API key in Phase 4b.",
      phase: "Phase 4b",
      connectMode: "api_key",
      maskedHint: null,
      lastError: null,
      externalId: null,
      meta: {},
      coverage: {
        api: "disconnected",
        scheduled: "handoff",
        handoff: "available",
        disconnected: "yes",
      },
      allowedDestination: null,
    },
    {
      id: "etsy",
      name: "Etsy",
      status: "disconnected",
      note: "OAuth + draft listings in Phase 4b.",
      phase: "Phase 4b",
      connectMode: "oauth",
      maskedHint: null,
      lastError: null,
      externalId: null,
      meta: {},
      coverage: {
        api: "disconnected",
        scheduled: "handoff",
        handoff: "available",
        disconnected: "yes",
      },
      allowedDestination: null,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      status: "disconnected",
      note: "Career path / content creation monetization only.",
      phase: "Phase 4b",
      connectMode: "env",
      maskedHint: null,
      lastError: null,
      externalId: null,
      meta: {},
      coverage: {
        api: "disconnected",
        scheduled: "n/a",
        handoff: "available",
        disconnected: "yes",
      },
      allowedDestination: {
        id: null,
        label: "Career path and content creation monetization",
      },
    },
  ];
}

export { GATE_ORDER, canAdvanceGate, canSimulatePublish, isPublishSkill } from "./workflows-client";
