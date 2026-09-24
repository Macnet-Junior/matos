import { parseJsonObject, prisma } from "@matos/db";
import { appendActivity } from "./map-data";
import {
  isContentPlatform,
  parseContentPackage,
  validateContentPackage,
  type ContentPlatform,
} from "./content-platforms";
import {
  BlogContentPublisher,
  EtsyContentPublisher,
  isLateSocialPlatform,
  LateContentPublisher,
  NewsletterContentPublisher,
  publishWithFallback,
  reconcileAsyncDelivery,
  selectLateAccount,
  SimulatedContentPublisher,
  WhatsAppContentPublisher,
  type ContentPublisher,
} from "./content-publishing";
import { EtsyClient, etsyEnv } from "./integrations/etsy";
import {
  isLateConnected,
  resolveLateApiKey,
} from "./integrations/accounts";
import { LateClient, lateApiBase } from "./integrations/late";
import { whatsappConfigFromEnv } from "./integrations/whatsapp";
import { recordProviderEvent } from "./content-observability";

async function publisherFor(channel: ContentPlatform): Promise<{
  provider: string;
  primary: ContentPublisher;
}> {
  if (isLateSocialPlatform(channel)) {
    try {
      const connected = await isLateConnected();
      const { key } = await resolveLateApiKey();
      if (connected && key) {
        const client = new LateClient({ apiKey: key, baseUrl: lateApiBase() });
        const accounts = await client.listAccounts();
        const account = selectLateAccount(accounts, channel);
        if (account) {
          return {
            provider: "late-dev",
            primary: new LateContentPublisher(client, account._id),
          };
        }
      }
    } catch {
      recordProviderEvent({
        provider: "late-dev",
        kind: "health",
        ok: false,
        simulated: true,
        reason: "provider_unavailable",
      });
      return { provider: "late-dev", primary: new SimulatedContentPublisher() };
    }
    return { provider: "late-dev", primary: new SimulatedContentPublisher() };
  }

  if (channel === "newsletter") {
    const deliveryUrl = process.env.NEWSLETTER_DELIVERY_URL?.trim() || null;
    return {
      provider: "native",
      primary: new NewsletterContentPublisher({
        deliveryUrl,
        fetchImpl: deliveryUrl ? fetch : undefined,
      }),
    };
  }
  if (channel === "blog") {
    const deliveryUrl = process.env.BLOG_DELIVERY_URL?.trim() || null;
    return {
      provider: "native",
      primary: new BlogContentPublisher({
        deliveryUrl,
        fetchImpl: deliveryUrl ? fetch : undefined,
      }),
    };
  }
  if (channel === "etsy") {
    const env = etsyEnv();
    return {
      provider: "etsy",
      primary: new EtsyContentPublisher({
        client: new EtsyClient({
          apiKey: env.apiKey ?? "unconfigured",
          accessToken: undefined,
        }),
        shopId: "sim_shop",
      }),
    };
  }
  const whatsapp = whatsappConfigFromEnv();
  return {
    provider: "whatsapp",
    primary: new WhatsAppContentPublisher({
      allowedTo: whatsapp.allowedTo,
      token: whatsapp.token,
      phoneNumberId: whatsapp.phoneNumberId,
    }),
  };
}

export async function publishDeskCalendarItem(input: {
  calendarItemId: string;
  actorEmail: string;
}) {
  const item = await prisma.deskCalendarItem.findUnique({
    where: { id: input.calendarItemId },
    include: { job: { include: { artifacts: true } } },
  });
  if (!item) throw new Error("Calendar item not found");
  if (!isContentPlatform(item.channel)) {
    throw new Error("Unsupported content platform");
  }
  const clock = item.job.artifacts.find((artifact) => artifact.stage === "clock");
  if (!clock || clock.reviewState !== "approved") {
    throw new Error("approval_required");
  }
  const pkg = parseContentPackage(item.packageJson);
  if (pkg) {
    const validation = validateContentPackage(pkg);
    if (!validation.ok) throw new Error("package_invalid");
  }
  if (item.status === "invalid") throw new Error("package_invalid");

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
        title: item.title,
        idempotencyKey,
        scheduledFor: item.scheduledAt.toISOString(),
        approved: true,
      },
      { maxAttempts: 3, baseDelayMs: 50 },
    );
    const updated = await prisma.deskPublication.update({
      where: { id: publication.id },
      data: {
        status: result.status,
        externalId: result.externalId,
        publishedAt: result.status === "published" && !result.simulated ? new Date() : null,
        metaJson: JSON.stringify({ ...(result.meta ?? {}), simulated: result.simulated }),
        error: result.meta?.fallback ? "provider_error" : null,
      },
    });
    await prisma.deskCalendarItem.update({
      where: { id: item.id },
      data: {
        status: result.simulated ? "simulated" : result.status,
        simulated: result.simulated,
      },
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
  } catch (error) {
    const code =
      error instanceof Error &&
      (error.message === "approval_required" ||
        error.message === "destination_rejected" ||
        error.message === "package_invalid")
        ? error.message
        : "provider_error";
    return prisma.deskPublication.update({
      where: { id: publication.id },
      data: { status: "failed", error: code },
    });
  }
}

export async function reconcileDeskPublication(input: {
  publicationId: string;
  actorEmail: string;
  readStatus?: () => Promise<"pending" | "published" | "failed">;
}) {
  const publication = await prisma.deskPublication.findUnique({
    where: { id: input.publicationId },
  });
  if (!publication) throw new Error("publication not found");
  const meta = parseJsonObject(publication.metaJson);
  const simulated =
    Boolean(publication.externalId?.startsWith("sim_")) ||
    meta.simulated === true ||
    meta.provider === "simulated" ||
    meta.fallback === true;
  const knownStatus =
    publication.status === "published" || publication.status === "failed"
      ? publication.status
      : "planned";
  const result = await reconcileAsyncDelivery({
    externalId: publication.externalId ?? "",
    simulated,
    knownStatus,
    readStatus: simulated ? undefined : input.readStatus,
    sleep: async () => undefined,
  });
  const updated = await prisma.deskPublication.update({
    where: { id: publication.id },
    data: {
      status: result.status === "planned" ? publication.status : result.status,
      metaJson: JSON.stringify({
        ...meta,
        simulated: result.simulated,
        reconciled: result.polled,
        deliveryStatus: result.status,
      }),
    },
  });
  await appendActivity({
    action: "desk.publication.reconciled",
    entityType: "desk_publication",
    entityId: updated.id,
    summary: `${publication.channel} delivery ${result.simulated ? "stayed simulated" : "reconciled"}`,
    actorEmail: input.actorEmail,
    payload: { channel: publication.channel, simulated: result.simulated },
  });
  return updated;
}
