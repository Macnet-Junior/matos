import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { auth } from "@/auth";
import { requireOwner } from "@/lib/owner";
import { updateWorkflowSchema } from "@/lib/validation";
import { appendActivity } from "@/lib/map-data";
import {
  asContentGate,
  canAdvanceGate,
  getWorkflow,
} from "@/lib/workflows";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const workflow = await getWorkflow(id);
  if (!workflow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const runs = await prisma.workflowRun.findMany({
    where: { workflowId: id },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  return NextResponse.json({
    workflow,
    runs: runs.map((r) => ({
      id: r.id,
      status: r.status,
      gateState: r.gateState,
      summary: r.summary,
      dryRun: r.dryRun,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
    })),
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireOwner();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { id } = await ctx.params;
  const existing = await prisma.workflow.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  if (parsed.data.gateState) {
    const check = canAdvanceGate(
      asContentGate(existing.gateState),
      parsed.data.gateState,
    );
    // Allow same-state no-op skip; only validate when changing
    if (parsed.data.gateState !== existing.gateState && !check.ok) {
      // Also allow setting via dedicated advance; for PATCH allow only valid transitions
      return NextResponse.json({ error: check.error }, { status: 400 });
    }
  }

  if (parsed.data.skillIds) {
    const skills = await prisma.skill.findMany({
      where: { id: { in: parsed.data.skillIds } },
    });
    if (skills.length !== parsed.data.skillIds.length) {
      return NextResponse.json(
        { error: "One or more skills not found" },
        { status: 400 },
      );
    }
    const byId = new Map(skills.map((s) => [s.id, s]));
    await prisma.workflowStep.deleteMany({ where: { workflowId: id } });
    await prisma.workflowStep.createMany({
      data: parsed.data.skillIds.map((skillId, i) => ({
        workflowId: id,
        skillId,
        sortOrder: i,
        label: byId.get(skillId)?.title ?? null,
      })),
    });
  }

  await prisma.workflow.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      gateState: parsed.data.gateState,
    },
  });

  await appendActivity({
    action: "workflow.update",
    entityType: "workflow",
    entityId: id,
    summary: `Updated workflow ${existing.slug}`,
    actorEmail: gate.email,
    payload: parsed.data as Record<string, unknown>,
  });

  const workflow = await getWorkflow(id);
  return NextResponse.json({ workflow });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireOwner();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { id } = await ctx.params;
  const existing = await prisma.workflow.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.workflow.delete({ where: { id } });
  await appendActivity({
    action: "workflow.delete",
    entityType: "workflow",
    entityId: id,
    summary: `Deleted workflow ${existing.slug}`,
    actorEmail: gate.email,
  });
  return NextResponse.json({ ok: true });
}

