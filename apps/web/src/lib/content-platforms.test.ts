import { describe, expect, it } from "vitest";
import {
  CONTENT_PLATFORMS,
  getContentPlatform,
  normalizeContentPlatforms,
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
});