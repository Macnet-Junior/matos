import { NextResponse } from "next/server";
import { requireSkillPackageImport } from "@/lib/owner";
import { loadMapPayload } from "@/lib/map-data";
import { importSkillsPackage } from "@/lib/skills-package";

export const dynamic = "force-dynamic";

/** Owner / Author — upsert skills from a matos-skills JSON / JSONL package. */
export async function POST(req: Request) {
  const gate = await requireSkillPackageImport();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const raw = await req.text().catch(() => "");
  const imported = await importSkillsPackage(raw, {
    email: gate.email,
    name: gate.name,
  });
  if (!imported.ok) {
    return NextResponse.json(
      { error: imported.error, issues: imported.issues },
      { status: imported.status },
    );
  }

  const map = await loadMapPayload(gate.email);
  return NextResponse.json({
    created: imported.result.created,
    updated: imported.result.updated,
    skills: imported.result.skills,
    map,
  });
}
