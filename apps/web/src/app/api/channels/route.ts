import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { channelStubs } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ channels: channelStubs() });
}
