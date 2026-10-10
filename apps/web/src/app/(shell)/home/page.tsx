import Link from "next/link";
import { Badge } from "@matos/ui";
import { ActivityEntry } from "@/components/ActivityEntry";
import { presentActivity } from "@/lib/activity-present";
import { loadHomeDigest, listChannels } from "@/lib/workflows";
import type { ChannelDTO, ContentGate } from "@/lib/types";

export const dynamic = "force-dynamic";

function gateTone(gate: ContentGate): "citron" | "muted" | "danger" {
  if (gate === "approved" || gate === "published" || gate === "scheduled") {
    return "citron";
  }
  return "muted";
}

function channelsLine(channels: ChannelDTO[]): string {
  if (channels.length === 0) {
    return "No channels are set up yet.";
  }
  const connected = channels.filter((channel) => channel.status === "connected");
  const names = channels.map((channel) => channel.name).join(", ");
  if (connected.length === 0) {
    return `${names} are not connected. Add a key there to publish for real. Until a channel is connected, publish stays simulated.`;
  }
  if (connected.length === channels.length) {
    return `${names} are connected. Open that page to check a key or disconnect.`;
  }
  const waiting = channels
    .filter((channel) => channel.status !== "connected")
    .map((channel) => channel.name)
    .join(", ");
  return `${connected.map((channel) => channel.name).join(", ")} connected. ${waiting} still need a key.`;
}

export default async function Page() {
  const [digest, channels] = await Promise.all([
    loadHomeDigest(),
    listChannels(),
  ]);
  const activity = await presentActivity(digest.recentActivity);

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Home</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Pending review gates, recent activity, and last dry-run summary.
        </p>
      </div>
      <div className="grid gap-4 overflow-auto p-[22px] lg:grid-cols-3">
        <section className="rounded-xl border border-matos-border bg-matos-panel p-4 lg:col-span-1">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Pending review gates
          </h2>
          <p className="mt-1 text-[11px] text-matos-muted">
            {digest.workflowCount} workflows · {digest.runCount} runs
          </p>
          <ul className="mt-3 space-y-2">
            {digest.pendingGates.length === 0 ? (
              <li className="text-xs text-matos-muted">
                Nothing waiting on draft/warm.
              </li>
            ) : (
              digest.pendingGates.slice(0, 12).map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-2 rounded-lg border border-matos-soft bg-matos-elev px-2.5 py-2 hover:border-matos-citron"
                  >
                    <span className="text-xs">
                      <span className="text-matos-muted2">{item.kind}</span>
                      <span className="ml-2">{item.name}</span>
                    </span>
                    <Badge tone={gateTone(item.gateState)}>
                      {item.gateState}
                    </Badge>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-matos-border bg-matos-panel p-4 lg:col-span-1">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Last run
          </h2>
          {digest.lastRun ? (
            <div className="mt-3 space-y-2">
              <Link
                href={`/workflows/runs/${digest.lastRun.id}`}
                className="block text-sm font-semibold tracking-tight hover:text-matos-citron"
              >
                {digest.lastRun.workflowName ?? "Workflow run"}
              </Link>
              <p className="text-xs text-matos-muted">{digest.lastRun.summary}</p>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="muted">{digest.lastRun.status}</Badge>
                <Badge tone={gateTone(digest.lastRun.gateState)}>
                  {digest.lastRun.gateState}
                </Badge>
                {digest.lastRun.dryRun ? (
                  <Badge tone="citron">dry-run</Badge>
                ) : null}
              </div>
              <time className="block text-[11px] text-matos-muted2">
                {new Date(digest.lastRun.startedAt).toLocaleString("en-US", {
                  timeZone: "America/New_York",
                })}
              </time>
            </div>
          ) : (
            <p className="mt-3 text-xs text-matos-muted">
              No runs yet. Open{" "}
              <Link href="/workflows" className="text-matos-citron">
                Workflows
              </Link>{" "}
              and dry-run a sample chain.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-matos-border bg-matos-panel p-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
              Recent activity
            </h2>
            <Link
              href="/activity"
              className="text-[11px] text-matos-citron hover:underline"
            >
              View all
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {activity.length === 0 ? (
              <li className="text-xs text-matos-muted">No activity yet.</li>
            ) : (
              activity.map((event) => (
                <li key={event.id}>
                  <ActivityEntry
                    variant="compact"
                    summary={event.summary}
                    actionLabel={event.actionLabel}
                    href={event.href}
                  />
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-matos-border bg-matos-panel p-4 lg:col-span-3">
          <h2 className="text-[11px] uppercase tracking-[0.08em] text-matos-muted2">
            Channels
          </h2>
          <p className="mt-2 text-xs text-matos-muted">
            {channelsLine(channels)}{" "}
            <Link href="/settings/channels" className="text-matos-citron">
              Publish &amp; Channels
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
