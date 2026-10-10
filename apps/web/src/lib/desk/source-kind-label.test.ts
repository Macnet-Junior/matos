import { describe, expect, it } from "vitest";
import { sourceKindLabel } from "./source-kind-label";

describe("source row label", () => {
  it("calls a YouTube address a YouTube source", () => {
    expect(sourceKindLabel("https://www.youtube.com/watch?v=eWKY0OnPByg")).toBe("YouTube");
    expect(sourceKindLabel("https://youtu.be/eWKY0OnPByg")).toBe("YouTube");
    expect(sourceKindLabel("https://m.youtube.com/watch?v=eWKY0OnPByg")).toBe("YouTube");
    expect(sourceKindLabel("https://www.youtube-nocookie.com/embed/eWKY0OnPByg")).toBe("YouTube");
  });

  it("does not call a YouTube address a pasted transcript", () => {
    expect(sourceKindLabel("https://www.youtube.com/watch?v=eWKY0OnPByg")).not.toBe(
      "Pasted transcript",
    );
  });

  it("keeps a real transcript paste labelled as one", () => {
    expect(sourceKindLabel("Pasted transcript")).toBe("Pasted transcript");
  });

  it("leaves other origins alone", () => {
    expect(sourceKindLabel("knowledge/notes.md")).toBeNull();
    expect(sourceKindLabel("https://example.com/watch?v=eWKY0OnPByg")).toBeNull();
  });
});
