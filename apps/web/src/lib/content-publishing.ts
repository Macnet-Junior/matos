import {
  getContentPlatform,
  type ContentPlatform,
} from "./content-platforms";
import { LateClient } from "./integrations/late";

export type ContentPublishInput = {
  channel: ContentPlatform;
  body: string;
  idempotencyKey: string;
  scheduledFor?: string | null;
  timezone?: string | null;
  accountId?: string | null;
};

export type ContentPublishResult = {
  externalId: string;
  status: "planned" | "published";
  scheduledFor?: string | null;
  simulated: boolean;
  meta?: Record<string, unknown>;
};

export type ContentPublishFallback = ContentPublishResult & {
  meta: Record<string, unknown> & {
    fallback: true;
    fallbackReason: "provider_error";
  };
};

export interface ContentPublisher {
  publish(input: ContentPublishInput): Promise<ContentPublishResult>;
}

export function publicPublishError(error: unknown): string {
  if (error instanceof TypeError) return "provider_unavailable";
  if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
    return "provider_timeout";
  }
  return "provider_error";
}

export async function publishWithFallback(
  primary: ContentPublisher,
  fallback: ContentPublisher,
  input: ContentPublishInput,
): Promise<ContentPublishResult | ContentPublishFallback> {
  try {
    return await primary.publish(input);
  } catch {
    const result = await fallback.publish(input);
    return {
      ...result,
      meta: {
        ...(result.meta ?? {}),
        fallback: true,
        fallbackReason: "provider_error",
      },
    };
  }
}

export class SimulatedContentPublisher implements ContentPublisher {
  async publish(input: ContentPublishInput): Promise<ContentPublishResult> {
    return {
      externalId: `sim_${input.idempotencyKey}`,
      status: input.scheduledFor ? "planned" : "published",
      scheduledFor: input.scheduledFor ?? null,
      simulated: true,
      meta: { channel: input.channel, provider: "simulated" },
    };
  }
}

export class LateContentPublisher implements ContentPublisher {
  constructor(
    private readonly client: LateClient,
    private readonly accountId: string,
  ) {}

  async publish(input: ContentPublishInput): Promise<ContentPublishResult> {
    const platform = getContentPlatform(input.channel);
    if (platform.provider !== "late-dev") {
      throw new Error(`Late cannot publish to ${input.channel}`);
    }

    const result = await this.client.createPost({
      content: input.body,
      platforms: [{ platform: input.channel, accountId: input.accountId ?? this.accountId }],
      scheduledFor: input.scheduledFor ?? undefined,
      timezone: input.timezone ?? undefined,
      publishNow: !input.scheduledFor,
    });
    const externalId = result.post?._id;
    if (!externalId) throw new Error("Late returned no post id");

    return {
      externalId,
      status: input.scheduledFor ? "planned" : "published",
      scheduledFor: result.post?.scheduledFor ?? input.scheduledFor ?? null,
      simulated: Boolean(result.simulated),
      meta: { provider: "late-dev", responseStatus: result.post?.status ?? null },
    };
  }
}

export function publisherProviderFor(channel: ContentPlatform): string {
  return getContentPlatform(channel).provider;
}