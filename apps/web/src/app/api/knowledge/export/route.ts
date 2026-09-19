import { NextResponse } from "next/server";
import { requireSkillPackageExport } from "@/lib/owner";
import { appendActivity } from "@/lib/map-data";
import { buildKnowledgeZip } from "@/lib/knowledge-archive";

export const dynamic = "force-dynamic";

/** Owner / Author — zip of the knowledge/ markdown tree. */
export async function GET() {
  const gate = await requireSkillPackageExport();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { buffer, files } = await buildKnowledgeZip();

  await appendActivity({
    action: "knowledge.export",
    entityType: "knowledge",
    entityId: "archive",
    summary: `Exported ${files.length} knowledge file(s)`,
    actorEmail: gate.email,
    payload: { count: files.length },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="matos-knowledge-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
