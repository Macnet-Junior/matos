import { afterEach, describe, expect, it } from "vitest";
import { listChannelStatus, nativeDeliveryChannels } from "./accounts";

const NEWS = "NEWSLETTER_DELIVERY_URL";
const BLOG = "BLOG_DELIVERY_URL";

describe("native delivery channels", () => {
  const previous = {
    newsletter: process.env[NEWS],
    blog: process.env[BLOG],
  };

  afterEach(() => {
    restore(NEWS, previous.newsletter);
    restore(BLOG, previous.blog);
  });

  it("lists newsletter and blog as simulated when no delivery URL is set", () => {
    const channels = nativeDeliveryChannels({});
    expect(channels.map((channel) => channel.id)).toEqual(["newsletter", "blog"]);
    expect(channels.every((channel) => channel.deliveryMode === "simulated")).toBe(true);
    expect(channels.every((channel) => channel.deliveryHost === null)).toBe(true);
  });

  it("shows live-configured with the host only", () => {
    const channels = nativeDeliveryChannels({
      NEWSLETTER_DELIVERY_URL: "http://user:secret@127.0.0.1:3099/deliver?token=secret",
      BLOG_DELIVERY_URL: "not a url",
    });
    const newsletter = channels.find((channel) => channel.id === "newsletter");
    const blog = channels.find((channel) => channel.id === "blog");
    expect(newsletter).toMatchObject({
      deliveryMode: "live-configured",
      deliveryHost: "127.0.0.1:3099",
      status: "connected",
    });
    expect(blog).toMatchObject({
      deliveryMode: "live-configured",
      deliveryHost: null,
    });
    const serialized = JSON.stringify(channels);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("/deliver");
    expect(serialized).not.toContain("token=");
    expect(serialized).not.toContain("not a url");
  });

  it("includes newsletter and blog on the channels page data", async () => {
    process.env[NEWS] = "http://127.0.0.1:3099/deliver";
    delete process.env[BLOG];
    const channels = await listChannelStatus();
    const newsletter = channels.find((channel) => channel.id === "newsletter");
    const blog = channels.find((channel) => channel.id === "blog");
    expect(newsletter?.deliveryMode).toBe("live-configured");
    expect(newsletter?.deliveryHost).toBe("127.0.0.1:3099");
    expect(blog?.deliveryMode).toBe("simulated");
    expect(channels.map((channel) => channel.id)).toEqual(
      expect.arrayContaining(["late-dev", "etsy", "whatsapp", "newsletter", "blog"]),
    );
    expect(JSON.stringify(channels)).not.toContain("/deliver");
  });
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
