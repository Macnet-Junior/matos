import { describe, expect, it, vi } from "vitest";
import { LateClient, simulateLateSchedule } from "./late";

describe("LateClient", () => {
  it("lists profiles with mocked fetch", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          profiles: [{ _id: "p1", name: "Brand", isDefault: true }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const client = new LateClient({
      apiKey: "sk_test",
      baseUrl: "https://example.test/api/v1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const profiles = await client.listProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Brand");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/api/v1/profiles",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk_test",
        }),
      }),
    );
  });

  it("creates a post with mocked fetch", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          message: "ok",
          post: { _id: "post1", status: "scheduled" },
        }),
        { status: 201 },
      );
    });

    const client = new LateClient({
      apiKey: "sk_test",
      baseUrl: "https://example.test/api/v1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await client.createPost({
      content: "Hello",
      publishNow: false,
      scheduledFor: "2027-01-01T12:00:00Z",
      platforms: [{ platform: "linkedin", accountId: "a1" }],
    });
    expect(result.post?._id).toBe("post1");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.test/api/v1/posts",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("simulates schedule without keys", () => {
    const sim = simulateLateSchedule({ content: "x" });
    expect(sim.simulated).toBe(true);
    expect(sim.post?.status).toBe("simulated");
  });
});
