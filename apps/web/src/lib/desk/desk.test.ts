import { describe, expect, it } from "vitest";
import {
  DESK_STAGES,
  STAGE_LABELS,
  nextStage,
  previousStage,
  isDeskStage,
  PlaceholderDeskProvider,
} from "./index";

describe("desk stages", () => {
  it("orders six stages then filed", () => {
    expect(DESK_STAGES).toEqual([
      "scout",
      "ghost",
      "editor",
      "press",
      "clock",
      "echo",
    ]);
    expect(nextStage("scout")).toBe("ghost");
    expect(nextStage("echo")).toBe("filed");
    expect(previousStage("scout")).toBeNull();
    expect(previousStage("ghost")).toBe("scout");
    expect(isDeskStage("press")).toBe(true);
    expect(isDeskStage("filed")).toBe(false);
    expect(STAGE_LABELS.echo).toBe("Echo");
  });
});

describe("placeholder provider", () => {
  it("generates deterministic scout notes without OPENAI_API_KEY", async () => {
    const provider = new PlaceholderDeskProvider();
    const out = await provider.generate({
      stage: "scout",
      brief: {
        title: "Test",
        topic: "Desk gates",
        audience: "Operators",
        offerCta: "Open Desk",
        channels: ["linkedin", "x"],
        dueAt: null,
      },
      priorArtifacts: [],
    });
    expect(out.title).toMatch(/Scout/i);
    expect(out.body).toContain("Desk gates");
    expect(out.meta.provider).toBe("placeholder");
  });
});
