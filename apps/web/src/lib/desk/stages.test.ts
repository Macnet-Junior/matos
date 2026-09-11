import { describe, expect, it } from "vitest";
import { normalizeDeskBody } from "./stages";

describe("normalizeDeskBody", () => {
  it("turns escaped newlines into real ones when the string has no real breaks", () => {
    const raw = "## Draft\\n\\nHook: hi";
    expect(normalizeDeskBody(raw)).toBe("## Draft\n\nHook: hi");
  });

  it("leaves real markdown alone", () => {
    const raw = "## Draft\n\nHook: hi";
    expect(normalizeDeskBody(raw)).toBe(raw);
  });
});
