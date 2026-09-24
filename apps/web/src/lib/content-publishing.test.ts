import { describe, expect, it } from "vitest";
import { LATE_SOCIAL_PLATFORMS } from "./content-platforms";
import { EtsyClient } from "./integrations/etsy";
import type { LateAccount } from "./integrations/late";
import { WhatsAppContentPublisher } from "./integrations/whatsapp";
import { resetProviderEvents } from "./content-observability";
import {
  BlogContentPublisher,
  NewsletterContentPublisher,
  buildLatePostPayload,
  publishWithFallback,
  publisherProviderFor,
  reconcileAsyncDelivery,
  resetNativeDeliveries,
  selectLateAccount,
  SimulatedContentPublisher,
  withPublishRetry,
  EtsyContentPublisher,
} from "./content-publishing";

describe("content publishing", () => {
  it("routes platforms to their owning provider", () => {
    expect(publisherProviderFor("linkedin")).toBe("late-dev");
    expect(publisherProviderFor("newsletter")).toBe("native");
    expect(publisherProviderFor("etsy")).toBe("etsy");
  });

  it("keeps local publishing deterministic and safe", async () => {
    const publisher = new SimulatedContentPublisher();
    await expect(
      publisher.publish({
        channel: "instagram",
        body: "A draft",
        idempotencyKey: "job-1-instagram",
      }),
    ).resolves.toMatchObject({
      externalId: "sim_job-1-instagram",
      status: "published",
      simulated: true,
    });
  });

  it("falls back without exposing provider errors or claiming a live post", async () => {
    const primary = {
      publish: async () => {
        throw new Error("Bearer secret-token leaked by provider");
      },
    };
    const result = await publishWithFallback(
      primary,
      new SimulatedContentPublisher(),
      {
        channel: "linkedin",
        body: "A draft",
        idempotencyKey: "job-2-linkedin",
      },
    );

    expect(result).toMatchObject({
      simulated: true,
      meta: { fallback: true, fallbackReason: "provider_error" },
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("maps every Late social destination to an active account and payload", () => {
    const accounts: LateAccount[] = LATE_SOCIAL_PLATFORMS.map((platform) => ({
      _id: `acct-${platform}`,
      platform,
      isActive: platform !== "reddit",
    }));
    accounts.push({ _id: "reddit-active", platform: "reddit", isActive: true });
    for (const platform of LATE_SOCIAL_PLATFORMS) {
      const account = selectLateAccount(accounts, platform);
      expect(account?._id).toBe(platform === "reddit" ? "reddit-active" : `acct-${platform}`);
      const payload = buildLatePostPayload(
        {
          channel: platform,
          body: "Approved pack",
          idempotencyKey: `job-${platform}`,
          approved: true,
        },
        account!._id,
      );
      expect(payload.platforms?.[0]).toEqual({
        platform,
        accountId: account!._id,
      });
    }
    expect(() =>
      buildLatePostPayload(
        { channel: "newsletter", body: "nope", idempotencyKey: "n", approved: true },
        "acct",
      ),
    ).toThrow(/Late cannot publish/);
  });

  it("retries transient provider failures with bounded backoff", async () => {
    const delays: number[] = [];
    let attempts = 0;
    const value = await withPublishRetry(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("provider_unavailable");
        return "ok";
      },
      {
        maxAttempts: 3,
        baseDelayMs: 25,
        sleep: async (ms) => {
          delays.push(ms);
        },
      },
    );
    expect(value).toBe("ok");
    expect(attempts).toBe(3);
    expect(delays).toEqual([25, 50]);
  });

  it("does not simulate a rejected WhatsApp destination", async () => {
    resetProviderEvents();
    const primary = new WhatsAppContentPublisher({ allowedTo: null });
    await expect(
      publishWithFallback(primary, new SimulatedContentPublisher(), {
        channel: "whatsapp",
        body: "hello",
        idempotencyKey: "wa-1",
        approved: true,
      }),
    ).rejects.toThrow("destination_rejected");
  });

  it("keeps newsletter and blog deliveries local until a sender is configured", async () => {
    resetNativeDeliveries();
    const newsletter = new NewsletterContentPublisher();
    const draft = await newsletter.draft({
      channel: "newsletter",
      body: "Draft letter",
      idempotencyKey: "letter-1",
    });
    expect(draft.simulated).toBe(true);
    expect(draft.status).toBe("planned");
    const published = await newsletter.publish({
      channel: "newsletter",
      body: "Draft letter",
      idempotencyKey: "letter-1",
      approved: true,
    });
    expect(published.simulated).toBe(true);
    expect(await newsletter.deliveryStatus(published.externalId)).toBe("published");

    const blog = new BlogContentPublisher();
    await expect(
      blog.publish({ channel: "blog", body: "Post", idempotencyKey: "b1" }),
    ).rejects.toThrow("approval_required");
    const scheduled = await blog.schedule({
      channel: "blog",
      body: "Post",
      idempotencyKey: "b1",
      scheduledFor: "2026-02-01T00:00:00.000Z",
      approved: true,
    });
    expect(scheduled.meta).toMatchObject({ deliveryStatus: "scheduled", channel: "blog" });
  });

  it("publishes Etsy only as a simulated draft without approval or a token", async () => {
    const publisher = new EtsyContentPublisher({
      client: new EtsyClient({ apiKey: "key" }),
      shopId: "sim_shop",
    });
    await expect(
      publisher.publish({
        channel: "etsy",
        body: "A listing",
        idempotencyKey: "etsy-1",
      }),
    ).rejects.toThrow("approval_required");
    const result = await publisher.publish({
      channel: "etsy",
      body: "A listing",
      title: "Desk print",
      idempotencyKey: "etsy-1",
      approved: true,
    });
    expect(result.simulated).toBe(true);
    expect(result.status).toBe("planned");
    expect(result.externalId.startsWith("sim_listing_")).toBe(true);
  });

  it("does not poll providers for simulated deliveries", async () => {
    let polled = false;
    const result = await reconcileAsyncDelivery({
      externalId: "sim_job",
      simulated: true,
      knownStatus: "planned",
      readStatus: async () => {
        polled = true;
        return "published";
      },
    });
    expect(polled).toBe(false);
    expect(result).toEqual({ status: "planned", simulated: true, polled: false });
  });
});