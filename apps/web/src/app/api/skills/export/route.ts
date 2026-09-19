import { NextResponse } from "next/server";
import { requireSkillPackageExport } from "@/lib/owner";
import { loadMapPayload, appendActivity } from "@/lib/map-data";
import { buildSkillsPackage } from "@/lib/skills-package";

export const dynamic = "force-dynamic";

/** Owner / Author — downloadable JSON package of skill records. */
export async function GET() {
  const gate = await requireSkillPackageExport();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const map = await loadMapPayload(gate.email, { reconcile: false });
  const body = buildSkillsPackage(map, gate.email);

  await appendActivity({
    action: "skill.export",
    entityType: "skill",
    entityId: "package",
    summary: `Exported ${body.count} skill(s)`,
    actorEmail: gate.email,
    payload: { count: body.count },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="matos-skills-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
