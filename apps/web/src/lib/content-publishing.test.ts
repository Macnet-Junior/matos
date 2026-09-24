import { describe, expect, it } from "vitest";
import {
  publishWithFallback,
  publisherProviderFor,
  SimulatedContentPublisher,
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
});