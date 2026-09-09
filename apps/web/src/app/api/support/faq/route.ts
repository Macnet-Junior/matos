import { NextResponse } from "next/server";
import { requireSupportUse } from "@/lib/owner";
import { loadFaqDocs, matchFaq } from "@/lib/ops/faq";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requireSupportUse();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const q = new URL(req.url).searchParams.get("q");
  if (q?.trim()) {
    const reply = await matchFaq(q);
    return NextResponse.json(reply);
  }
  const docs = await loadFaqDocs();
  return NextResponse.json({
    docs: docs.map((d) => ({ path: d.path, title: d.title })),
  });
}
