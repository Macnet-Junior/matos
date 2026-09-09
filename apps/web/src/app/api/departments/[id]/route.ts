import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { requireOwner } from "@/lib/owner";
import { updateDepartmentSchema } from "@/lib/validation";
import { appendActivity, loadMapPayload, toDepartmentDTO } from "@/lib/map-data";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireOwner();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = updateDepartmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const dept = await prisma.department.update({
    where: { id },
    data: {
      name: parsed.data.name,
      summary: parsed.data.summary,
      expanded: parsed.data.expanded,
    },
    include: { skills: { include: { knowledge: true } } },
  });

  await appendActivity({
    action: "department.update",
    entityType: "department",
    entityId: dept.id,
    summary: `Updated department ${dept.name}`,
    actorEmail: gate.email,
    payload: parsed.data,
  });

  const map = await loadMapPayload(gate.email);
  return NextResponse.json({ department: toDepartmentDTO(dept), map });
}
