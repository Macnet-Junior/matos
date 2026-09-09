import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listChannelStatus } from "@/lib/integrations/accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const channels = await listChannelStatus();
  return NextResponse.json({ channels });
}
