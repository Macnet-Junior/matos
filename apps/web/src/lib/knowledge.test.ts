import { describe, expect, it } from "vitest";

function portablePath(value: string | null): string {
  return (value ?? "").replace(/\\/g, "/");
}
import {
  deriveSkillStatus,
  evaluateSkillEncoding,
  listKnowledgeMarkdown,
  resolveKnowledgePath,
} from "./knowledge";
import type { SkillDTO } from "./types";

describe("knowledge paths", () => {
  it("allows knowledge/ paths and blocks traversal", () => {
    expect(portablePath(resolveKnowledgePath("knowledge/brand/voice.md"))).toContain(
      "knowledge/brand/voice.md",
    );
    expect(resolveKnowledgePath("../etc/passwd")).toBeNull();
    expect(resolveKnowledgePath("knowledge/../../etc/passwd")).toBeNull();
    expect(resolveKnowledgePath("apps/web/package.json")).toBeNull();
  });

  it("lists the repo knowledge markdown tree", async () => {
    const files = await listKnowledgeMarkdown();
    expect(files).toEqual(
      expect.arrayContaining([
        "knowledge/brand/voice.md",
        "knowledge/content/mix-ratios.md",
      ]),
    );
    expect(files.every((f) => f.startsWith("knowledge/") && f.endsWith(".md"))).toBe(
      true,
    );
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

describe("evaluateSkillEncoding", () => {
  const base: Pick<
    SkillDTO,
    | "id"
    | "slug"
    | "title"
    | "status"
    | "purpose"
    | "steps"
    | "reviewGate"
    | "knowledge"
  > = {
    id: "skill-x",
    slug: "hook-lab",
    title: "Hook Lab",
    status: "authored",
    purpose: "Earn the scroll-stop",
    steps: ["Draft", "Score"],
    reviewGate: "Warm",
    knowledge: [
      {
        id: "k1",
        path: "knowledge/brand/voice.md",
        title: "Brand voice",
        sortOrder: 0,
      },
    ],
  };

  it("passes when purpose, steps, gate, and knowledge exist", () => {
    const result = evaluateSkillEncoding(base, "Script & Story");
    expect(result.pass).toBe(true);
    expect(result.checks.every((c) => c.pass)).toBe(true);
  });

  it("fails when purpose or knowledge missing", () => {
    const result = evaluateSkillEncoding(
      { ...base, purpose: "", knowledge: [] },
      "Script & Story",
    );
    expect(result.pass).toBe(false);
    expect(result.checks.find((c) => c.id === "purpose")?.pass).toBe(false);
    expect(result.checks.find((c) => c.id === "knowledge")?.pass).toBe(false);
  });
});
