import { NextResponse } from "next/server";
import { getSessionFlags } from "@/lib/owner";
import { loadMapPayload } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { email } = await getSessionFlags();
    const payload = await loadMapPayload(email);
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load map";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
