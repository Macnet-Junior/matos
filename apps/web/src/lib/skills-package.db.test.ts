import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import { importSkillsPackage } from "./skills-package";

const SLUG = "import-roundtrip-probe";

describe("importSkillsPackage (SQLite)", () => {
  let departmentId = "";
  let departmentSlug = "";

  beforeAll(async () => {
    const dept = await prisma.department.findFirst({
      where: { slug: "script" },
    });
    if (!dept) {
      throw new Error("Database not seeded — run pnpm db:seed");
    }
    departmentId = dept.id;
    departmentSlug = dept.slug;
    await prisma.skill.deleteMany({ where: { slug: SLUG } });
  });

  afterAll(async () => {
    await prisma.skill.deleteMany({ where: { slug: SLUG } });
  });

  it("creates then upserts without wiping unrelated skills", async () => {
    const before = await prisma.skill.count();
    const created = await importSkillsPackage(
      JSON.stringify({
        format: "matos-skills",
        version: 1,
        skills: [
          {
            slug: SLUG,
            title: "Import Probe",
            description: "Temporary skill used by the import test.",
            departmentSlug,
            status: "planned",
            reviewGate: "Cold",
            purpose: "Verify upsert",
            instructions: "First write",
            steps: ["One"],
            knowledgePaths: ["knowledge/brand/voice.md"],
          },
        ],
      }),
      { email: "macnet@matos.local", name: "Macnet Junior" },
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.result.created).toBe(1);
    expect(created.result.updated).toBe(0);

    const updated = await importSkillsPackage(
      JSON.stringify({
        format: "matos-skills",
        version: 1,
        skills: [
          {
            slug: SLUG,
            title: "Import Probe Updated",
            description: "Temporary skill used by the import test.",
            departmentId,
            status: "planned",
            reviewGate: "Warm",
            purpose: "Verify upsert",
            instructions: "Second write",
            steps: ["One", "Two"],
            knowledgePaths: ["knowledge/brand/voice.md"],
          },
        ],
      }),
      { email: "macnet@matos.local", name: "Macnet Junior" },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.result.created).toBe(0);
    expect(updated.result.updated).toBe(1);
    expect(updated.result.skills[0]?.title).toBe("Import Probe Updated");
    expect(updated.result.skills[0]?.steps).toEqual(["One", "Two"]);

    const after = await prisma.skill.count();
    expect(after).toBe(before + 1);

    const hook = await prisma.skill.findFirst({
      where: { slug: "hook-lab" },
    });
    expect(hook).toBeTruthy();
  });

  it("rejects unknown departments without writing", async () => {
    const before = await prisma.skill.count({ where: { slug: SLUG } });
    const failed = await importSkillsPackage(
      JSON.stringify({
        skills: [
          {
            slug: "ghost-dept-skill",
            title: "Ghost",
            description: "Should not land",
            departmentSlug: "does-not-exist",
          },
        ],
      }),
      { email: "macnet@matos.local", name: "Macnet Junior" },
    );
    expect(failed.ok).toBe(false);
    if (!failed.ok) {
      expect(failed.status).toBe(400);
      expect(failed.error).toMatch(/Department not found/);
    }
    const ghost = await prisma.skill.findFirst({
      where: { slug: "ghost-dept-skill" },
    });
    expect(ghost).toBeNull();
    expect(await prisma.skill.count({ where: { slug: SLUG } })).toBe(before);
  });
});
