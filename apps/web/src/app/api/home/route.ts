import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loadHomeDigest } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const digest = await loadHomeDigest();
  return NextResponse.json({ digest });
}
