import { describe, expect, it } from "vitest";
import type { MapPayload } from "./types";
import {
  buildSkillsPackage,
  parseSkillsPackageRaw,
  skillToPackageItem,
} from "./skills-package";

const item = {
  slug: "hook-lab",
  title: "Hook Lab",
  description: "Generate hooks",
  departmentSlug: "script",
  status: "authored" as const,
  reviewGate: "Warm" as const,
  purpose: "Earn the scroll-stop",
  instructions: "Draft hooks",
  steps: ["Draft", "Score"],
  knowledgePaths: ["knowledge/brand/voice.md"],
};

describe("parseSkillsPackageRaw", () => {
  it("parses a wrapped JSON package", () => {
    const raw = JSON.stringify({
      format: "matos-skills",
      version: 1,
      skills: [item],
    });
    const parsed = parseSkillsPackageRaw(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.skills).toHaveLength(1);
      expect(parsed.skills[0]?.slug).toBe("hook-lab");
    }
  });

  it("parses a bare JSON array", () => {
    const parsed = parseSkillsPackageRaw(JSON.stringify([item]));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.skills[0]?.title).toBe("Hook Lab");
  });

  it("parses JSONL", () => {
    const second = {
      ...item,
      slug: "short-script",
      title: "Short Script",
    };
    const raw = `${JSON.stringify(item)}\n${JSON.stringify(second)}\n`;
    const parsed = parseSkillsPackageRaw(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.skills.map((s) => s.slug)).toEqual([
        "hook-lab",
        "short-script",
      ]);
    }
  });

  it("rejects invalid JSON", () => {
    const parsed = parseSkillsPackageRaw("{not-json");
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toBe("Invalid JSON");
  });

  it("rejects missing department identity", () => {
    const parsed = parseSkillsPackageRaw(
      JSON.stringify({
        slug: "hook-lab",
        title: "Hook Lab",
        description: "Generate hooks",
      }),
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toBe("Validation failed");
  });

  it("rejects knowledge path traversal", () => {
    const parsed = parseSkillsPackageRaw(
      JSON.stringify({
        ...item,
        knowledgePaths: ["knowledge/../../secret.md"],
      }),
    );
    expect(parsed.ok).toBe(false);
  });

  it("accepts name as a title alias", () => {
    const parsed = parseSkillsPackageRaw(
      JSON.stringify({
        slug: "hook-lab",
        name: "Hook Lab",
        description: "Generate hooks",
        departmentSlug: "script",
      }),
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.skills[0]?.name).toBe("Hook Lab");
  });
});

describe("buildSkillsPackage", () => {
  it("includes department slug and knowledgePaths for recreate", () => {
    const map = {
      departments: [
        {
          slug: "script",
          name: "Script & Story",
          skills: [
            {
              id: "s1",
              departmentId: "d1",
              slug: "hook-lab",
              title: "Hook Lab",
              description: "Generate hooks",
              status: "authored",
              owner: "Macnet Junior",
              reviewGate: "Warm",
              purpose: "Earn the scroll-stop",
              instructions: "Draft",
              steps: ["One"],
              evidence: [],
              knowledge: [
                {
                  id: "k1",
                  path: "knowledge/brand/voice.md",
                  title: "Voice",
                  sortOrder: 0,
                },
              ],
              posX: null,
              posY: null,
            },
          ],
        },
      ],
    } as unknown as MapPayload;

    const pkg = buildSkillsPackage(map, "macnet@matos.local");
    expect(pkg.format).toBe("matos-skills");
    expect(pkg.version).toBe(1);
    expect(pkg.count).toBe(1);
    expect(pkg.skills[0]).toMatchObject({
      slug: "hook-lab",
      departmentSlug: "script",
      knowledgePaths: ["knowledge/brand/voice.md"],
    });
    expect(skillToPackageItem(map.departments[0]!.skills[0]!, map.departments[0]!).title).toBe(
      "Hook Lab",
    );
  });
});
