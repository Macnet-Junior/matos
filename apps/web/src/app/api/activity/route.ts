import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { auth } from "@/auth";
import { toActivityDTO } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);

  const rows = await prisma.activityEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ events: rows.map(toActivityDTO) });
}
