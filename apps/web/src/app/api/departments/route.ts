import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { requireOwner } from "@/lib/owner";
import { createDepartmentSchema } from "@/lib/validation";
import { appendActivity, loadMapPayload, toDepartmentDTO } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireOwner();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = createDepartmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const company = await prisma.company.findFirst();
  if (!company) {
    return NextResponse.json({ error: "Company missing" }, { status: 500 });
  }

  const maxOrder = await prisma.department.aggregate({
    where: { companyId: company.id },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  const angle = -Math.PI / 2 + sortOrder * 0.7;
  const posX = Math.round(280 + Math.cos(angle) * 260);
  const posY = Math.round(220 + Math.sin(angle) * 260);

  try {
    const dept = await prisma.department.create({
      data: {
        companyId: company.id,
        slug: parsed.data.slug,
        name: parsed.data.name,
        summary: parsed.data.summary,
        sortOrder,
        posX,
        posY,
        expanded: false,
      },
      include: { skills: { include: { knowledge: true } } },
    });

    await appendActivity({
      action: "department.create",
      entityType: "department",
      entityId: dept.id,
      summary: `Created department ${dept.name}`,
      actorEmail: gate.email,
      payload: { slug: dept.slug },
    });

    const map = await loadMapPayload(gate.email);
    return NextResponse.json(
      { department: toDepartmentDTO(dept), map },
      { status: 201 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
