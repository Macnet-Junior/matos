import { prisma } from "@matos/db";
import { appendActivity } from "./map-data";
import {
  isContentPlatform,
  type ContentPlatform,
} from "./content-platforms";
import {
  LateContentPublisher,
  publishWithFallback,
  SimulatedContentPublisher,
  type ContentPublisher,
} from "./content-publishing";
import {
  isLateConnected,
  resolveLateApiKey,
} from "./integrations/accounts";
import { LateClient, lateApiBase } from "./integrations/late";

async function publisherFor(channel: ContentPlatform): Promise<{
  provider: string;
  primary: ContentPublisher;
}> {
  if (channel === "linkedin" || channel === "x" || channel === "instagram" ||
      channel === "facebook" || channel === "threads" || channel === "tiktok" ||
      channel === "youtube" || channel === "pinterest" || channel === "reddit") {
    try {
      const connected = await isLateConnected();
      const { key } = await resolveLateApiKey();
      if (connected && key) {
        const client = new LateClient({ apiKey: key, baseUrl: lateApiBase() });
        const accounts = await client.listAccounts();
        const account = accounts.find(
          (item) => item.platform === channel && item.isActive !== false,
        ) ?? accounts.find((item) => item.platform === channel);
        if (account) {
          return {
            provider: "late-dev",
            primary: new LateContentPublisher(client, account._id),
          };
        }
      }
    } catch {
      return { provider: "late-dev", primary: new SimulatedContentPublisher() };
    }
    return { provider: "late-dev", primary: new SimulatedContentPublisher() };
  }

  return { provider: channel === "etsy" ? "etsy" : channel === "whatsapp" ? "whatsapp" : "native", primary: new SimulatedContentPublisher() };
}

export async function publishDeskCalendarItem(input: {
  calendarItemId: string;
  actorEmail: string;
}) {
  const item = await prisma.deskCalendarItem.findUnique({
    where: { id: input.calendarItemId },
    include: { job: true },
  });
  if (!item) throw new Error("Calendar item not found");
  if (!isContentPlatform(item.channel)) {
    throw new Error("Unsupported content platform");
  }

  const idempotencyKey = `desk-calendar:${item.id}`;
  const existing = await prisma.deskPublication.findUnique({
    where: { idempotencyKey },
  });
  if (existing?.status === "published" || existing?.status === "planned") {
    return existing;
  }

  const { provider, primary } = await publisherFor(item.channel);
  const publication = await prisma.deskPublication.upsert({
    where: { idempotencyKey },
    create: {
      jobId: item.jobId,
      channel: item.channel,
      provider,
      idempotencyKey,
      status: "publishing",
      scheduledAt: item.scheduledAt,
      attemptCount: 1,
      lastAttemptAt: new Date(),
    },
    update: {
      status: "publishing",
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      error: null,
    },
  });

  try {
    const result = await publishWithFallback(
      primary,
      new SimulatedContentPublisher(),
      {
        channel: item.channel,
        body: item.body,
        idempotencyKey,
        scheduledFor: item.scheduledAt.toISOString(),
      },
    );
    const updated = await prisma.deskPublication.update({
      where: { id: publication.id },
      data: {
        status: result.status,
        externalId: result.externalId,
        publishedAt: result.status === "published" ? new Date() : null,
        metaJson: JSON.stringify(result.meta ?? {}),
        error: result.meta?.fallback ? "provider_error" : null,
      },
    });
    await prisma.deskCalendarItem.update({
      where: { id: item.id },
      data: { status: result.simulated ? "simulated" : "published" },
    });
    await appendActivity({
      action: "desk.publication.completed",
      entityType: "desk_publication",
      entityId: updated.id,
      summary: `${item.channel} publication ${result.simulated ? "simulated" : "completed"}`,
      actorEmail: input.actorEmail,
      payload: { channel: item.channel, simulated: result.simulated },
    });
    return updated;
  } catch {
    return prisma.deskPublication.update({
      where: { id: publication.id },
      data: { status: "failed", error: "provider_error" },
    });
  }
}