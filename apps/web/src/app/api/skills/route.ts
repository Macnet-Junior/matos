import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { requireSkillEdit } from "@/lib/owner";
import { createSkillSchema } from "@/lib/validation";
import { appendActivity, loadMapPayload, toSkillDTO } from "@/lib/map-data";
import { deriveSkillStatus } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireSkillEdit();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = createSkillSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const dept = await prisma.department.findUnique({
    where: { id: parsed.data.departmentId },
  });
  if (!dept) {
    return NextResponse.json({ error: "Department not found" }, { status: 404 });
  }

  try {
    const skill = await prisma.skill.create({
      data: {
        departmentId: parsed.data.departmentId,
        slug: parsed.data.slug,
        title: parsed.data.title,
        description: parsed.data.description,
        status: parsed.data.status,
        owner: parsed.data.owner ?? gate.name,
        reviewGate: parsed.data.reviewGate,
        purpose: parsed.data.purpose ?? "",
        instructions: parsed.data.instructions ?? "",
        stepsJson: JSON.stringify(parsed.data.steps ?? []),
        evidenceJson: JSON.stringify(parsed.data.evidence ?? []),
        knowledge: {
          create: (parsed.data.knowledgePaths ?? []).map((path, i) => ({
            path,
            sortOrder: i,
          })),
        },
      },
      include: { knowledge: true },
    });

    await prisma.department.update({
      where: { id: dept.id },
      data: { expanded: true },
    });

    let dto = toSkillDTO(skill);
    const derived = await deriveSkillStatus(dto);
    if (derived !== dto.status) {
      const synced = await prisma.skill.update({
        where: { id: skill.id },
        data: { status: derived },
        include: { knowledge: true },
      });
      dto = toSkillDTO(synced);
    }

    await appendActivity({
      action: "skill.create",
      entityType: "skill",
      entityId: skill.id,
      summary: `Created skill ${skill.slug}`,
      actorEmail: gate.email,
      payload: { departmentId: dept.id, status: dto.status },
    });

    const map = await loadMapPayload(gate.email);
    return NextResponse.json({ skill: dto, map }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Slug already exists in department" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
