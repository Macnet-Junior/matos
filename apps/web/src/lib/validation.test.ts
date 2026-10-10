import { describe, expect, it } from "vitest";
import { parseEvidenceLinks } from "@matos/db";
import {
  createDepartmentSchema,
  createDeskSourceSchema,
  createSkillSchema,
  formatValidationError,
  ingestDeskSourceSchema,
  skillPackageItemSchema,
  skillsPackageSchema,
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

  it("saves a pasted web address that left off https://", () => {
    // Company map → Content Studio → Brief Card → Evidence.
    // The owner pasted www.etsy.com/listing/123 and the save returned 400.
    const parsed = updateSkillSchema.safeParse({
      evidence: [
        {
          url: "knowledge/content/etsy-listing-checklist.md",
          label: "Etsy checklist",
        },
        { url: "  www.etsy.com/listing/123  ", label: "Offer page" },
        { url: "etsy.com/shop/matos", label: "Shop" },
        { url: "youtu.be/dQw4w9WgXcQ", label: "Walkthrough" },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.evidence?.map((item) => item.url)).toEqual([
      "knowledge/content/etsy-listing-checklist.md",
      "https://www.etsy.com/listing/123",
      "https://etsy.com/shop/matos",
      "https://youtu.be/dQw4w9WgXcQ",
    ]);
  });

  it("accepts a long web link and a legacy string evidence row", () => {
    const longUrl = `https://example.com/${"a".repeat(600)}`;
    const parsed = updateSkillSchema.safeParse({
      evidence: [longUrl, { url: "/knowledge/brand/voice.md", label: "Voice" }],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.evidence?.[0]).toEqual({
      url: longUrl,
      label: longUrl.slice(0, 120),
    });
    expect(parsed.data.evidence?.[1]?.url).toBe("/knowledge/brand/voice.md");
  });

  it("rejects evidence without url/label", () => {
    const parsed = updateSkillSchema.safeParse({
      evidence: [{ url: "", label: "x" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("names the evidence field when the address is not a link", () => {
    const parsed = updateSkillSchema.safeParse({
      evidence: [
        { url: "knowledge/brand/voice.md", label: "Voice" },
        { url: "not a link", label: "Note" },
      ],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const message = formatValidationError(parsed.error);
    expect(message).toContain("Evidence link 2 address");
    expect(message).toContain("web link");
    expect(message).toContain("knowledge/");
    expect(message.toLowerCase()).not.toContain("validation failed");
  });

  it("names other skill fields on the same save", () => {
    const parsed = updateSkillSchema.safeParse({
      title: "A",
      description: "",
      status: "Nope",
      steps: ["ok", "x".repeat(401)],
      knowledgePaths: ["k".repeat(201)],
      evidence: [{ url: "https://example.com", label: "L".repeat(121) }],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const message = formatValidationError(parsed.error);
    expect(message).toContain("Title needs at least 2 characters.");
    expect(message).toContain("Description needs at least 2 characters.");
    expect(message).toContain("Status must be one of: authored, planned, missing.");
    expect(message).toContain("Step 2 must be 400 characters or fewer.");
    expect(message).toContain("Knowledge path 1 must be 200 characters or fewer.");
    expect(message).toContain("Evidence link 1 label must be 120 characters or fewer.");
    expect(message.toLowerCase()).not.toContain("validation failed");
  });

  it("names review gate, purpose, and owner on the same save", () => {
    const parsed = updateSkillSchema.safeParse({
      reviewGate: "lukewarm",
      purpose: "p".repeat(501),
      owner: "",
      instructions: "i".repeat(8001),
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const message = formatValidationError(parsed.error);
    expect(message).toContain("Review gate must be one of: Cold, Warm, Hot.");
    expect(message).toContain("Purpose must be 500 characters or fewer.");
    expect(message).toContain("Owner needs at least 1 character.");
    expect(message).toContain("Instructions must be 8000 characters or fewer.");
  });

  it("does not treat a markdown filename as a web address", () => {
    const parsed = updateSkillSchema.safeParse({
      evidence: [{ url: "voice.md", label: "Voice" }],
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(formatValidationError(parsed.error)).toContain(
      "Evidence link 1 address",
    );
  });

  it("accepts a skills package item with departmentSlug", () => {
    const parsed = skillPackageItemSchema.safeParse({
      slug: "hook-lab",
      title: "Hook Lab",
      description: "Generate hooks",
      departmentSlug: "script",
      status: "authored",
      reviewGate: "Warm",
      knowledgePaths: ["knowledge/brand/voice.md"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects skill package items that escape knowledge/", () => {
    const parsed = skillPackageItemSchema.safeParse({
      slug: "hook-lab",
      title: "Hook Lab",
      description: "Generate hooks",
      departmentSlug: "script",
      knowledgePaths: ["knowledge/../../etc/passwd"],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty skills package", () => {
    const parsed = skillsPackageSchema.safeParse({
      format: "matos-skills",
      version: 1,
      skills: [],
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

describe("desk source schemas", () => {
  it("accepts a source with a loose origin", () => {
    // The origin is a URL for a video, a path for an upload, or the owner's
    // own description of a call. All three have to survive validation, because
    // rejecting a free-form origin pushes the owner to invent a URL for
    // material that has none.
    for (const origin of [
      "https://youtube.test/watch?v=abc",
      "workspace/media/call.m4a",
      "a pricing call with Dana, recorded on my phone",
    ]) {
      const parsed = createDeskSourceSchema.safeParse({
        kind: "call",
        title: "Pricing call",
        origin,
      });
      expect(parsed.success).toBe(true);
    }
  });

  it("refuses an unknown kind rather than defaulting it", () => {
    // A kind that silently became "doc" would file a video under the wrong
    // shape and the mistake would only surface at transcription time.
    const parsed = createDeskSourceSchema.safeParse({
      kind: "podcast",
      title: "Not a kind",
      origin: "somewhere",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires a non-empty title and origin", () => {
    expect(
      createDeskSourceSchema.safeParse({
        kind: "video",
        title: "",
        origin: "workspace/media/a.mp4",
      }).success,
    ).toBe(false);
    expect(
      createDeskSourceSchema.safeParse({
        kind: "video",
        title: "A talk",
        origin: "   ",
      }).success,
    ).toBe(false);
  });

  it("accepts a null jobId and rejects a blank one", () => {
    // Null is the common case — material is collected before there is a job.
    expect(
      createDeskSourceSchema.safeParse({
        kind: "article",
        title: "Standalone",
        origin: "https://blog.test/post",
        jobId: null,
      }).success,
    ).toBe(true);
    expect(
      createDeskSourceSchema.safeParse({
        kind: "article",
        title: "Standalone",
        origin: "https://blog.test/post",
        jobId: "",
      }).success,
    ).toBe(false);
  });

  it("requires a file path for ingest", () => {
    expect(
      ingestDeskSourceSchema.safeParse({ filePath: "/media/talk.mp4" }).success,
    ).toBe(true);
    expect(ingestDeskSourceSchema.safeParse({}).success).toBe(false);
    expect(ingestDeskSourceSchema.safeParse({ filePath: "" }).success).toBe(
      false,
    );
  });
});
