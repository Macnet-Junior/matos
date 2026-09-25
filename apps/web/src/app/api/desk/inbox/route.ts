import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deskOwner, listInboxItems } from "@/lib/desk";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const items = await listInboxItems(deskOwner(session.user.email));
  return NextResponse.json({ items });
}
