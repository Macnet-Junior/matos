import { NextResponse } from "next/server";
import { getSessionFlags } from "@/lib/owner";
import { loadMapPayload } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = performance.now();
  try {
    const { email } = await getSessionFlags();
    // Lean path: skip status reconcile on poll; SSR /map still reconciles.
    const payload = await loadMapPayload(email, { reconcile: false });
    const ms = Math.round(performance.now() - started);
    if (process.env.NODE_ENV !== "test") {
      console.info(`[map] GET /api/map ${ms}ms depts=${payload.departments.length} skills=${payload.stats.skillCount} role=${payload.role}`);
    }
    const res = NextResponse.json(payload);
    res.headers.set("Server-Timing", `map;dur=${ms}`);
    res.headers.set("X-Matos-Map-Ms", String(ms));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load map";
    const ms = Math.round(performance.now() - started);
    console.warn(`[map] GET /api/map failed after ${ms}ms: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
