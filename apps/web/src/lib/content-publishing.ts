import {
  getContentPlatform,
  LATE_SOCIAL_PLATFORMS,
  type ContentPlatform,
} from "./content-platforms";
import { recordProviderEvent, type SafeProviderReason } from "./content-observability";
import { EtsyContentPublisher } from "./integrations/etsy";
import {
  LateClient,
  type LateAccount,
  type LateCreatePostInput,
} from "./integrations/late";
import { WhatsAppContentPublisher } from "./integrations/whatsapp";

export type ContentPublishInput = {
  channel: ContentPlatform;
  body: string;
  title?: string;
  idempotencyKey: string;
  scheduledFor?: string | null;
  timezone?: string | null;
  accountId?: string | null;
  /** Desk approval is required before any non-simulated publisher runs. */
  approved?: boolean;
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

export type NativeDeliveryState = "draft" | "scheduled" | "published" | "failed";

export interface ContentPublisher {
  publish(input: ContentPublishInput): Promise<ContentPublishResult>;
}

const BLOCKED_FALLBACK = new Set([
  "approval_required",
  "destination_rejected",
  "package_invalid",
]);

export function publicPublishError(error: unknown): string {
  if (error instanceof TypeError) return "provider_unavailable";
  if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
    return "provider_timeout";
  }
  if (error instanceof Error && BLOCKED_FALLBACK.has(error.message)) {
    return error.message;
  }
  return "provider_error";
}

export function isTransientPublishError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;
  if (BLOCKED_FALLBACK.has(error.message)) return false;
  return /timeout|timed out|provider_unavailable|429|502|503|504/i.test(error.message);
}

export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export async function withPublishRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 200;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  let last: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isTransientPublishError(error) || attempt === maxAttempts) throw error;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw last;
}

export function canFallback(error: unknown): boolean {
  return !(error instanceof Error && BLOCKED_FALLBACK.has(error.message));
}

export async function publishWithFallback(
  primary: ContentPublisher,
  fallback: ContentPublisher,
  input: ContentPublishInput,
  retry: RetryOptions = {},
): Promise<ContentPublishResult | ContentPublishFallback> {
  const provider = publisherProviderFor(input.channel);
  try {
    const result = await withPublishRetry(() => primary.publish(input), retry);
    recordProviderEvent({
      provider,
      kind: "delivery",
      ok: true,
      simulated: result.simulated,
    });
    return result;
  } catch (error) {
    if (!canFallback(error)) {
      recordProviderEvent({
        provider,
        kind: "delivery",
        ok: false,
        simulated: false,
        reason: publicPublishError(error) as SafeProviderReason,
      });
      throw error;
    }
    const result = await fallback.publish(input);
    recordProviderEvent({
      provider,
      kind: "fallback",
      ok: true,
      simulated: true,
      reason: "provider_error",
    });
    return {
      ...result,
      simulated: true,
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

export function selectLateAccount(
  accounts: LateAccount[],
  channel: ContentPlatform,
): LateAccount | null {
  const matches = accounts.filter((item) => item.platform === channel);
  return matches.find((item) => item.isActive !== false) ?? matches[0] ?? null;
}

export function buildLatePostPayload(
  input: ContentPublishInput,
  accountId: string,
): LateCreatePostInput {
  const platform = getContentPlatform(input.channel);
  if (platform.provider !== "late-dev") {
    throw new Error(`Late cannot publish to ${input.channel}`);
  }
  if (input.body.length > platform.limits.maxChars) {
    throw new Error("package_invalid");
  }
  return {
    content: input.body,
    platforms: [{ platform: input.channel, accountId: input.accountId ?? accountId }],
    scheduledFor: input.scheduledFor ?? undefined,
    timezone: input.timezone ?? undefined,
    publishNow: !input.scheduledFor,
  };
}

export class LateContentPublisher implements ContentPublisher {
  constructor(
    private readonly client: LateClient,
    private readonly accountId: string,
  ) {}

  async publish(input: ContentPublishInput): Promise<ContentPublishResult> {
    if (!input.approved) throw new Error("approval_required");
    const payload = buildLatePostPayload(input, this.accountId);
    try {
      const result = await this.client.createPost(payload);
      const externalId = result.post?._id;
      if (!externalId) throw new Error("provider_error");
      return {
        externalId,
        status: input.scheduledFor ? "planned" : "published",
        scheduledFor: result.post?.scheduledFor ?? input.scheduledFor ?? null,
        simulated: Boolean(result.simulated),
        meta: {
          provider: "late-dev",
          responseStatus: result.post?.status ?? null,
          deliveryStatus: result.post?.status ?? (input.scheduledFor ? "scheduled" : "published"),
        },
      };
    } catch (error) {
      if (error instanceof Error && error.message === "approval_required") throw error;
      throw new Error(publicPublishError(error));
    }
  }
}

type NativeRecord = {
  externalId: string;
  state: NativeDeliveryState;
  simulated: boolean;
  channel: ContentPlatform;
};

const nativeDeliveries = new Map<string, NativeRecord>();

export function readNativeDelivery(externalId: string): NativeRecord | null {
  return nativeDeliveries.get(externalId) ?? null;
}

export function resetNativeDeliveries(): void {
  nativeDeliveries.clear();
}

class LocalNativePublisher implements ContentPublisher {
  constructor(
    private readonly channel: "newsletter" | "blog",
    private readonly deliveryUrl: string | null,
    private readonly fetchImpl?: typeof fetch,
  ) {}

  async draft(input: ContentPublishInput): Promise<ContentPublishResult> {
    return this.store(input, "draft");
  }

  async schedule(input: ContentPublishInput): Promise<ContentPublishResult> {
    if (!input.approved) throw new Error("approval_required");
    return this.store(input, "scheduled");
  }

  async publish(input: ContentPublishInput): Promise<ContentPublishResult> {
    if (!input.approved) throw new Error("approval_required");
    const state: NativeDeliveryState = input.scheduledFor ? "scheduled" : "published";
    return this.store(input, state);
  }

  async deliveryStatus(externalId: string): Promise<NativeDeliveryState | null> {
    return nativeDeliveries.get(externalId)?.state ?? null;
  }

  private async store(
    input: ContentPublishInput,
    state: NativeDeliveryState,
  ): Promise<ContentPublishResult> {
    const externalId = `${this.channel}_${input.idempotencyKey}`;
    let simulated = !this.deliveryUrl;
    if (this.deliveryUrl && this.fetchImpl && state !== "draft") {
      try {
        const res = await this.fetchImpl(this.deliveryUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: this.channel,
            idempotencyKey: input.idempotencyKey,
            state,
          }),
        });
        if (!res.ok) throw new Error(res.status >= 500 ? "provider_unavailable" : "provider_error");
        simulated = false;
      } catch (error) {
        throw new Error(publicPublishError(error));
      }
    }
    nativeDeliveries.set(externalId, {
      externalId,
      state,
      simulated,
      channel: this.channel,
    });
    return {
      externalId,
      status: state === "published" ? "published" : "planned",
      scheduledFor: input.scheduledFor ?? null,
      simulated,
      meta: {
        provider: "native",
        channel: this.channel,
        deliveryStatus: state,
      },
    };
  }
}

export class NewsletterContentPublisher extends LocalNativePublisher {
  constructor(opts?: { deliveryUrl?: string | null; fetchImpl?: typeof fetch }) {
    super("newsletter", opts?.deliveryUrl ?? null, opts?.fetchImpl);
  }
}

export class BlogContentPublisher extends LocalNativePublisher {
  constructor(opts?: { deliveryUrl?: string | null; fetchImpl?: typeof fetch }) {
    super("blog", opts?.deliveryUrl ?? null, opts?.fetchImpl);
  }
}

export { EtsyContentPublisher, WhatsAppContentPublisher };

export function publisherProviderFor(channel: ContentPlatform): string {
  return getContentPlatform(channel).provider;
}

export function isLateSocialPlatform(channel: string): channel is (typeof LATE_SOCIAL_PLATFORMS)[number] {
  return (LATE_SOCIAL_PLATFORMS as readonly string[]).includes(channel);
}

export type ReconcileStatus = "planned" | "published" | "failed";

/**
 * Reconcile an asynchronous provider result.
 * Simulated deliveries are never promoted to live.
 */
export async function reconcileAsyncDelivery(input: {
  externalId: string;
  simulated: boolean;
  knownStatus?: ReconcileStatus;
  readStatus?: () => Promise<"pending" | "published" | "failed">;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
}): Promise<{ status: ReconcileStatus; simulated: boolean; polled: boolean }> {
  if (input.simulated || input.externalId.startsWith("sim_")) {
    return {
      status: input.knownStatus ?? "planned",
      simulated: true,
      polled: false,
    };
  }
  if (!input.readStatus) {
    return { status: input.knownStatus ?? "planned", simulated: false, polled: false };
  }
  const remote = await withPublishRetry(() => input.readStatus!(), {
    maxAttempts: input.maxAttempts ?? 3,
    baseDelayMs: 10,
    sleep: input.sleep ?? (async () => undefined),
  });
  if (remote === "published") return { status: "published", simulated: false, polled: true };
  if (remote === "failed") return { status: "failed", simulated: false, polled: true };
  return { status: "planned", simulated: false, polled: true };
}
