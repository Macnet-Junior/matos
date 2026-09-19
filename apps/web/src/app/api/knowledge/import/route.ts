import { NextResponse } from "next/server";
import { requireSkillPackageImport } from "@/lib/owner";
import { appendActivity } from "@/lib/map-data";
import {
  MAX_KNOWLEDGE_ZIP_BYTES,
  applyKnowledgeZip,
} from "@/lib/knowledge-archive";

export const dynamic = "force-dynamic";

async function readZipBuffer(
  req: Request,
): Promise<
  | { ok: true; buffer: Buffer; confirm: boolean }
  | { ok: false; error: string; status: number }
> {
  const contentType = req.headers.get("content-type") ?? "";
  const url = new URL(req.url);

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) {
      return { ok: false, status: 400, error: "Invalid multipart body" };
    }
    const file = form.get("file");
    const confirm =
      form.get("confirm") === "1" ||
      form.get("confirm") === "true" ||
      url.searchParams.get("confirm") === "1";
    if (!(file instanceof File)) {
      return {
        ok: false,
        status: 400,
        error: "Multipart field `file` (zip) is required",
      };
    }
    if (file.size > MAX_KNOWLEDGE_ZIP_BYTES) {
      return { ok: false, status: 400, error: "Zip exceeds 10MB limit" };
    }
    return {
      ok: true,
      buffer: Buffer.from(await file.arrayBuffer()),
      confirm,
    };
  }

  if (
    contentType.includes("application/zip") ||
    contentType.includes("application/octet-stream") ||
    contentType.includes("application/x-zip-compressed")
  ) {
    const ab = await req.arrayBuffer();
    if (ab.byteLength > MAX_KNOWLEDGE_ZIP_BYTES) {
      return { ok: false, status: 400, error: "Zip exceeds 10MB limit" };
    }
    return {
      ok: true,
      buffer: Buffer.from(ab),
      confirm: url.searchParams.get("confirm") === "1",
    };
  }

  return {
    ok: false,
    status: 400,
    error:
      "Expected a zip (multipart field `file` or application/zip body). Merge import requires confirm=1.",
  };
}

/** Owner / Author — merge a zip of markdown into knowledge/ (no wipe). */
export async function POST(req: Request) {
  const gate = await requireSkillPackageImport();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const uploaded = await readZipBuffer(req);
  if (!uploaded.ok) {
    return NextResponse.json(
      { error: uploaded.error },
      { status: uploaded.status },
    );
  }

  const applied = await applyKnowledgeZip(uploaded.buffer, {
    confirm: uploaded.confirm,
  });
  if (!applied.ok) {
    return NextResponse.json(
      { error: applied.error, rejected: applied.rejected },
      { status: applied.status },
    );
  }

  await appendActivity({
    action: "knowledge.import",
    entityType: "knowledge",
    entityId: "archive",
    summary: `Imported ${applied.result.written.length} knowledge file(s) (${applied.result.overwritten.length} overwritten)`,
    actorEmail: gate.email,
    payload: {
      written: applied.result.written,
      overwritten: applied.result.overwritten,
    },
  });

  return NextResponse.json({
    written: applied.result.written,
    overwritten: applied.result.overwritten,
    skipped: applied.result.skipped,
    policy:
      "merge — matching knowledge/ paths are overwritten; other files are left in place",
  });
}
