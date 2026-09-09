import { describe, expect, it } from "vitest";
import { deriveSkillStatus, resolveKnowledgePath } from "./knowledge";

describe("knowledge paths", () => {
  it("allows knowledge/ paths and blocks traversal", () => {
    expect(resolveKnowledgePath("knowledge/brand/voice.md")).toContain(
      "knowledge/brand/voice.md",
    );
    expect(resolveKnowledgePath("../etc/passwd")).toBeNull();
    expect(resolveKnowledgePath("knowledge/../../etc/passwd")).toBeNull();
    expect(resolveKnowledgePath("apps/web/package.json")).toBeNull();
  });
});

describe("deriveSkillStatus", () => {
  it("marks complete skills authored", async () => {
    const status = await deriveSkillStatus({
      instructions: "Do the work",
      knowledge: [{ path: "knowledge/brand/voice.md" }],
      status: "planned",
    });
    expect(status).toBe("authored");
  });

  it("marks empty content planned", async () => {
    const status = await deriveSkillStatus({
      instructions: "",
      knowledge: [],
      status: "planned",
    });
    expect(status).toBe("planned");
  });

  it("marks missing knowledge as missing", async () => {
    const status = await deriveSkillStatus({
      instructions: "Do the work",
      knowledge: [{ path: "knowledge/does-not-exist.md" }],
      status: "authored",
    });
    expect(status).toBe("missing");
  });
});
