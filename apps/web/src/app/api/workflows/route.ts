import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { auth } from "@/auth";
import { requireWorkflowManage } from "@/lib/owner";
import { createWorkflowSchema } from "@/lib/validation";
import { appendActivity } from "@/lib/map-data";
import { getWorkflow, listWorkflows, toWorkflowDTO } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workflows = await listWorkflows();
  return NextResponse.json({ workflows });
}

export async function POST(req: Request) {
  const gate = await requireWorkflowManage();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = createWorkflowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

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

  try {
    const wf = await prisma.workflow.create({
      data: {
        slug: parsed.data.slug,
        name: parsed.data.name,
        description: parsed.data.description ?? "",
        gateState: "draft",
        steps: {
          create: parsed.data.skillIds.map((skillId, i) => ({
            skillId,
            sortOrder: i,
            label: byId.get(skillId)?.title ?? null,
          })),
        },
      },
      include: {
        steps: { include: { skill: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    await appendActivity({
      action: "workflow.create",
      entityType: "workflow",
      entityId: wf.id,
      summary: `Created workflow ${wf.slug}`,
      actorEmail: gate.email,
      payload: { skillIds: parsed.data.skillIds },
    });

    const dto = await getWorkflow(wf.id);
    return NextResponse.json({ workflow: dto ?? toWorkflowDTO(wf) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
