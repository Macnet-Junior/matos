import { describe, expect, it } from "vitest";
import { parseEvidenceLinks } from "@matos/db";
import {
  createDepartmentSchema,
  createSkillSchema,
  updateSkillSchema,
} from "./validation";
import { computeAutoArrange, computeStats } from "./map-layout";
import type { DepartmentDTO } from "./types";

describe("Zod validation", () => {
  it("accepts a valid department payload", () => {
    const parsed = createDepartmentSchema.safeParse({
      name: "Research Engine",
      summary: "Signals and intel",
      slug: "research",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects bad department slugs", () => {
    const parsed = createDepartmentSchema.safeParse({
      name: "X",
      summary: "y",
      slug: "Bad Slug",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts skill create with defaults", () => {
    const parsed = createSkillSchema.safeParse({
      departmentId: "dept-script",
      slug: "hook-lab",
      title: "Hook Lab",
      description: "Generate hooks",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.status).toBe("planned");
      expect(parsed.data.reviewGate).toBe("Warm");
    }
  });

  it("accepts skill update with steps", () => {
    const parsed = updateSkillSchema.safeParse({
      instructions: "Do the work",
      steps: ["One", "Two"],
      status: "authored",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts evidence link objects", () => {
    const parsed = updateSkillSchema.safeParse({
      evidence: [
        { url: "https://example.com/proof", label: "Proof" },
        { url: "knowledge/brand/voice.md", label: "Voice" },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects evidence without url/label", () => {
    const parsed = updateSkillSchema.safeParse({
      evidence: [{ url: "", label: "x" }],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("map helpers", () => {
  it("computes stats from department DTOs", () => {
    const departments = [
      {
        skills: [
          { status: "authored" },
          { status: "planned" },
          { status: "missing" },
        ],
      },
      { skills: [{ status: "authored" }] },
    ] as unknown as DepartmentDTO[];
    expect(computeStats(departments)).toEqual({
      departmentCount: 2,
      skillCount: 4,
      authored: 2,
      planned: 1,
      missing: 1,
    });
  });

  it("auto-arranges deterministically", () => {
    const a = computeAutoArrange([
      { id: "d1", skills: [{ id: "s1" }, { id: "s2" }] },
      { id: "d2", skills: [{ id: "s3" }] },
    ]);
    const b = computeAutoArrange([
      { id: "d1", skills: [{ id: "s1" }, { id: "s2" }] },
      { id: "d2", skills: [{ id: "s3" }] },
    ]);
    expect(a).toEqual(b);
    expect(a.departments).toHaveLength(2);
    expect(a.skills).toHaveLength(3);
    expect(a.company.posX).toBe(320);
  });
});

describe("parseEvidenceLinks", () => {
  it("parses objects and legacy strings", () => {
    expect(
      parseEvidenceLinks(
        JSON.stringify([
          { url: "https://a.test", label: "A" },
          "legacy-note",
        ]),
      ),
    ).toEqual([
      { url: "https://a.test", label: "A" },
      { url: "legacy-note", label: "legacy-note" },
    ]);
  });
});
