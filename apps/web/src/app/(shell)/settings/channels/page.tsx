import { listChannelStatus } from "@/lib/integrations/accounts";
import { getSessionFlags } from "@/lib/owner";
import { ChannelsPanel } from "@/components/ChannelsPanel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const channels = await listChannelStatus();
  const flags = await getSessionFlags();

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">
          Publish &amp; Channels
        </h1>
        <p className="mt-1.5 max-w-2xl text-xs text-matos-muted">
          Phase 4b adapters: Late.dev / Zernio, Etsy OAuth, WhatsApp Cloud
          (allowlisted destination only). Keys stay server-side; without keys,
          publish paths stay simulated.
        </p>
      </div>
      <div className="overflow-auto p-[22px]">
        <ChannelsPanel
          initialChannels={channels}
          canManage={flags.canManageMap}
        />
      </div>
    </main>
  );
}
