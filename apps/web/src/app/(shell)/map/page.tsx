import { MapShell } from "@/components/MapShell";
import { getSessionFlags } from "@/lib/owner";
import { loadMapPayload } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ skill?: string }>;
}) {
  const { email } = await getSessionFlags();
  const initial = await loadMapPayload(email);
  const { skill } = await searchParams;
  return <MapShell initial={initial} focusSkillSlug={skill} />;
}
