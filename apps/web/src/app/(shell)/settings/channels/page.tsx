import { Badge } from "@matos/ui";
import { channelStubs } from "@/lib/workflows";

export const dynamic = "force-dynamic";

export default function Page() {
  const channels = channelStubs();

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">
          Publish &amp; Channels
        </h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Integration stubs only. No live OAuth or external posts in Phase 3.
        </p>
      </div>
      <div className="space-y-3 overflow-auto p-[22px]">
        {channels.map((ch) => (
          <article
            key={ch.id}
            className="rounded-xl border border-matos-border bg-matos-panel p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight">
                  {ch.name}
                </h2>
                <p className="mt-2 max-w-2xl text-xs text-matos-muted">
                  {ch.note}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge tone="muted">Disconnected</Badge>
                <span className="rounded-lg border border-matos-border px-3 py-1.5 text-[11px] text-matos-muted2">
                  {ch.phase}
                </span>
              </div>
            </div>
            {ch.id === "whatsapp" ? (
              <p className="mt-3 rounded-lg border border-matos-soft bg-matos-elev px-3 py-2 text-[11px] text-matos-muted">
                Scope when live: group <strong className="text-matos-text">Career path</strong> and{" "}
                <strong className="text-matos-text">
                  content creation monetization
                </strong>{" "}
                only — not general WhatsApp Web automation.
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </main>
  );
}
