import { describe, expect, it } from "vitest";
import {
  CONTENT_PLATFORMS,
  getContentPlatform,
  normalizeContentPlatforms,
  validateContentPackage,
  type ContentPackage,
} from "./content-platforms";

describe("content platforms", () => {
  it("defines every supported destination once", () => {
    expect(Object.keys(CONTENT_PLATFORMS)).toHaveLength(13);
    expect(getContentPlatform("linkedin").provider).toBe("late-dev");
    expect(getContentPlatform("etsy").capabilities.scheduling).toBe(false);
  });

  it("normalizes and deduplicates user-selected destinations", () => {
    expect(normalizeContentPlatforms([" LinkedIn ", "linkedin", "TIKTOK", "fax"])).toEqual([
      "linkedin",
      "tiktok",
    ]);
  });

  it("rejects unknown destinations when resolving definitions", () => {
    expect(() => getContentPlatform("fax")).toThrow(
      "Unsupported content platform: fax",
    );
  });

  it("rejects over-length text, unsupported links, and missing required media", () => {
    const tooLong: ContentPackage = {
      channel: "x",
      title: "X",
      text: "a".repeat(281),
      links: [],
      media: [],
      hashtags: [],
    };
    expect(validateContentPackage(tooLong).errors).toContain(
      "text exceeds 280 characters",
    );

    const etsyLinks: ContentPackage = {
      channel: "etsy",
      title: "Listing",
      text: "Handmade desk print",
      links: ["https://example.com"],
      media: [{ kind: "image", ref: "cover.jpg" }],
      hashtags: [],
    };
    expect(validateContentPackage(etsyLinks).errors).toContain("links are not supported");

    const instagram: ContentPackage = {
      channel: "instagram",
      title: "IG",
      text: "A caption",
      links: [],
      media: [],
      hashtags: [],
    };
    expect(validateContentPackage(instagram).ok).toBe(false);
    expect(validateContentPackage(instagram).errors).toContain("media is required");

    const newsletter: ContentPackage = {
      channel: "newsletter",
      title: "Letter",
      text: "A short letter",
      links: ["https://example.com/desk"],
      media: [],
      hashtags: [],
    };
    expect(validateContentPackage(newsletter).ok).toBe(true);
  });
});