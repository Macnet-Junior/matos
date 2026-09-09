import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { requireOwner } from "@/lib/owner";
import { autoArrangeSchema, layoutSchema } from "@/lib/validation";
import { appendActivity, loadMapPayload } from "@/lib/map-data";
import { computeAutoArrange } from "@/lib/map-layout";

export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const gate = await requireOwner();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = layoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.company) {
      await tx.company.update({
        where: { id: parsed.data.company.id },
        data: {
          posX: parsed.data.company.posX,
          posY: parsed.data.company.posY,
        },
      });
    }
    for (const d of parsed.data.departments ?? []) {
      await tx.department.update({
        where: { id: d.id },
        data: {
          posX: d.posX,
          posY: d.posY,
          ...(d.expanded !== undefined ? { expanded: d.expanded } : {}),
        },
      });
    }
    for (const s of parsed.data.skills ?? []) {
      await tx.skill.update({
        where: { id: s.id },
        data: { posX: s.posX, posY: s.posY },
      });
    }
  });

  await appendActivity({
    action: "layout.update",
    entityType: "map",
    entityId: "company-map",
    summary: "Persisted map positions",
    actorEmail: gate.email,
  });

  const map = await loadMapPayload(gate.email);
  return NextResponse.json({ map });
}

export async function POST(req: Request) {
  const gate = await requireOwner();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = autoArrangeSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const company = await prisma.company.findFirst({
    include: {
      departments: {
        orderBy: { sortOrder: "asc" },
        include: { skills: true },
      },
    },
  });
  if (!company) {
    return NextResponse.json({ error: "Company missing" }, { status: 500 });
  }

  const layout = computeAutoArrange(company.departments);

  await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: company.id },
      data: { posX: layout.company.posX, posY: layout.company.posY },
    });
    for (const d of layout.departments) {
      await tx.department.update({
        where: { id: d.id },
        data: {
          posX: d.posX,
          posY: d.posY,
          ...(parsed.data.expandAll ? { expanded: true } : {}),
        },
      });
    }
    for (const s of layout.skills) {
      await tx.skill.update({
        where: { id: s.id },
        data: { posX: s.posX, posY: s.posY },
      });
    }
  });

  await appendActivity({
    action: "layout.auto_arrange",
    entityType: "map",
    entityId: company.id,
    summary: "Auto-arranged company map",
    actorEmail: gate.email,
  });

  const map = await loadMapPayload(gate.email);
  return NextResponse.json({ map });
}
