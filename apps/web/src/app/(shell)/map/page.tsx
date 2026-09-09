import { MapShell } from "@/components/MapShell";
import { getSessionFlags } from "@/lib/owner";
import { loadMapPayload } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const { email } = await getSessionFlags();
  const initial = await loadMapPayload(email);
  return <MapShell initial={initial} />;
}
