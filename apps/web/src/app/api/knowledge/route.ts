import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { readKnowledgeFile } from "@/lib/knowledge";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pathParam = searchParams.get("path");
  if (!pathParam) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  const result = await readKnowledgeFile(pathParam);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result);
}
