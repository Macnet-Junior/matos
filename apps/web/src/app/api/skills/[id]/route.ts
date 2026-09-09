import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { requireOwner } from "@/lib/owner";
import { updateSkillSchema } from "@/lib/validation";
import { appendActivity, loadMapPayload, toSkillDTO } from "@/lib/map-data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireOwner();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = updateSkillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.skill.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (parsed.data.departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: parsed.data.departmentId },
    });
    if (!dept) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }
  }

  const skill = await prisma.$transaction(async (tx) => {
    if (parsed.data.knowledgePaths) {
      await tx.skillKnowledge.deleteMany({ where: { skillId: id } });
      await tx.skillKnowledge.createMany({
        data: parsed.data.knowledgePaths.map((path, i) => ({
          skillId: id,
          path,
          sortOrder: i,
        })),
      });
    }

    return tx.skill.update({
      where: { id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        owner: parsed.data.owner,
        reviewGate: parsed.data.reviewGate,
        purpose: parsed.data.purpose,
        instructions: parsed.data.instructions,
        stepsJson:
          parsed.data.steps !== undefined
            ? JSON.stringify(parsed.data.steps)
            : undefined,
        evidenceJson:
          parsed.data.evidence !== undefined
            ? JSON.stringify(parsed.data.evidence)
            : undefined,
        departmentId: parsed.data.departmentId,
      },
      include: { knowledge: true },
    });
  });

  await appendActivity({
    action: "skill.update",
    entityType: "skill",
    entityId: skill.id,
    summary: `Updated skill ${skill.slug}`,
    actorEmail: gate.email,
    payload: parsed.data,
  });

  const map = await loadMapPayload(gate.email);
  return NextResponse.json({ skill: toSkillDTO(skill), map });
}
