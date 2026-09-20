import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  collectKnowledgeRefs,
  deriveSkillStatus,
  evaluateSkillEncoding,
  listKnowledgeMarkdown,
  repoRoot,
  resolveKnowledgePath,
} from "./knowledge";
import type { SkillDTO } from "./types";

describe("knowledge paths", () => {
  it("allows knowledge/ paths and blocks traversal", () => {
    expect(resolveKnowledgePath("knowledge/brand/voice.md")).toContain(
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
    expect(
      files.every((f) => f.startsWith("knowledge/") && f.endsWith(".md")),
    ).toBe(true);
  });
});

describe("collectKnowledgeRefs", () => {
  it("dedupes knowledge paths and knowledge/ evidence URLs", () => {
    expect(
      collectKnowledgeRefs({
        knowledge: [
          { path: "knowledge/brand/voice.md" },
          { path: "knowledge/brand/voice.md" },
        ],
        evidence: [
          { url: "knowledge/brand/voice.md" },
          { url: "https://example.com/proof" },
          { url: "knowledge/content/mix-ratios.md" },
        ],
      }),
    ).toEqual(["knowledge/brand/voice.md", "knowledge/content/mix-ratios.md"]);
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

  it("does not keep a stored missing label when nothing is claimed", async () => {
    const status = await deriveSkillStatus({
      instructions: "",
      knowledge: [],
      status: "missing",
    });
    expect(status).toBe("planned");
  });

  it("keeps planned skills planned when linked files exist but instructions are empty", async () => {
    const status = await deriveSkillStatus({
      instructions: "",
      knowledge: [{ path: "knowledge/brand/voice.md" }],
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

  it("marks instructions without knowledge links as missing", async () => {
    const status = await deriveSkillStatus({
      instructions: "Do the work",
      knowledge: [],
      status: "authored",
    });
    expect(status).toBe("missing");
  });

  it("marks broken evidence knowledge URLs as missing", async () => {
    const status = await deriveSkillStatus({
      instructions: "Do the work",
      knowledge: [{ path: "knowledge/brand/voice.md" }],
      evidence: [{ url: "knowledge/does-not-exist.md" }],
      status: "authored",
    });
    expect(status).toBe("missing");
  });
});

describe("seeded skill knowledge refs", () => {
  function extractSeedKnowledgeRefs(source: string): string[] {
    const refs = new Set<string>();
    const re = /(?:path|url):\s*"(knowledge\/[^"]+\.md)"/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) {
      refs.add(match[1]);
    }
    return [...refs].sort();
  }

  it("every knowledge path/url in seed.ts exists on disk", async () => {
    const seedPath = path.join(repoRoot(), "packages/db/prisma/seed.ts");
    const source = fs.readFileSync(seedPath, "utf8");
    expect(source).not.toMatch(/status:\s*"missing"/);
    const refs = extractSeedKnowledgeRefs(source);
    expect(refs.length).toBeGreaterThan(0);
    const missing: string[] = [];
    for (const rel of refs) {
      const abs = resolveKnowledgePath(rel);
      if (!abs || !fs.existsSync(abs)) missing.push(rel);
    }
    expect(missing).toEqual([]);
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
