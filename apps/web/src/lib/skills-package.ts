import { prisma } from "@matos/db";
import { deriveSkillStatus } from "@/lib/knowledge";
import { appendActivity, toSkillDTO } from "@/lib/map-data";
import type { MapPayload, SkillDTO } from "@/lib/types";
import {
  createSkillSchema,
  skillPackageItemSchema,
  skillsPackageSchema,
  updateSkillSchema,
} from "@/lib/validation";
import type { z } from "zod";

export const SKILLS_PACKAGE_FORMAT = "matos-skills" as const;
export const SKILLS_PACKAGE_VERSION = 1 as const;
export const MAX_SKILLS_PACKAGE_BYTES = 2_000_000;

export type SkillPackageItem = z.infer<typeof skillPackageItemSchema>;

export type SkillsPackage = {
  format: typeof SKILLS_PACKAGE_FORMAT;
  version: typeof SKILLS_PACKAGE_VERSION;
  exportedAt: string;
  exportedBy: string;
  count: number;
  skills: SkillPackageItem[];
};

export type SkillsImportResult = {
  created: number;
  updated: number;
  skills: SkillDTO[];
};

export function skillToPackageItem(
  skill: SkillDTO,
  department: { slug: string; name: string },
): SkillPackageItem {
  return {
    id: skill.id,
    slug: skill.slug,
    title: skill.title,
    description: skill.description,
    departmentId: skill.departmentId,
    departmentSlug: department.slug,
    departmentName: department.name,
    status: skill.status,
    owner: skill.owner,
    reviewGate: skill.reviewGate,
    purpose: skill.purpose,
    instructions: skill.instructions,
    steps: skill.steps,
    evidence: skill.evidence,
    knowledge: skill.knowledge,
    knowledgePaths: skill.knowledge.map((k) => k.path),
    posX: skill.posX,
    posY: skill.posY,
  };
}

export function buildSkillsPackage(
  map: MapPayload,
  exportedBy: string,
): SkillsPackage {
  const skills = map.departments.flatMap((d) =>
    d.skills.map((s) => skillToPackageItem(s, d)),
  );
  return {
    format: SKILLS_PACKAGE_FORMAT,
    version: SKILLS_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy,
    count: skills.length,
    skills,
  };
}

function isJsonl(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;
  return lines.every((l) => l.startsWith("{") && l.endsWith("}"));
}

export function parseSkillsPackageRaw(raw: string):
  | { ok: true; skills: SkillPackageItem[] }
  | {
      ok: false;
      error: string;
      issues?: unknown;
    } {
  if (Buffer.byteLength(raw, "utf8") > MAX_SKILLS_PACKAGE_BYTES) {
    return { ok: false, error: "Package exceeds 2MB limit" };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty package" };
  }

  if (isJsonl(trimmed)) {
    const skills: SkillPackageItem[] = [];
    const issues: Array<{ line: number; error: string; issues?: unknown }> = [];
    const lines = trimmed.split(/\r?\n/);
    let lineNo = 0;
    for (const line of lines) {
      lineNo += 1;
      const t = line.trim();
      if (!t) continue;
      let obj: unknown;
      try {
        obj = JSON.parse(t);
      } catch {
        issues.push({ line: lineNo, error: "Invalid JSONL line" });
        continue;
      }
      const parsed = skillPackageItemSchema.safeParse(obj);
      if (!parsed.success) {
        issues.push({
          line: lineNo,
          error: "Validation failed",
          issues: parsed.error.flatten(),
        });
        continue;
      }
      skills.push(parsed.data);
    }
    if (issues.length) {
      return { ok: false, error: "Validation failed", issues };
    }
    if (skills.length === 0) {
      return { ok: false, error: "No skills to import" };
    }
    if (skills.length > 500) {
      return { ok: false, error: "Package exceeds 500 skills" };
    }
    return { ok: true, skills };
  }

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }

  if (Array.isArray(data)) {
    data = { format: SKILLS_PACKAGE_FORMAT, version: 1, skills: data };
  } else if (
    data &&
    typeof data === "object" &&
    !Array.isArray((data as { skills?: unknown }).skills) &&
    "slug" in data
  ) {
    data = { format: SKILLS_PACKAGE_FORMAT, version: 1, skills: [data] };
  }

  const parsed = skillsPackageSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      issues: parsed.error.flatten(),
    };
  }
  return { ok: true, skills: parsed.data.skills };
}

function packageKey(item: SkillPackageItem): string {
  return `${item.departmentSlug ?? item.departmentId}::${item.slug}`;
}

function knowledgePathsOf(item: SkillPackageItem): string[] | undefined {
  if (item.knowledgePaths) return item.knowledgePaths;
  if (item.knowledge) return item.knowledge.map((k) => k.path);
  return undefined;
}

export async function importSkillsPackage(
  raw: string,
  actor: { email: string; name: string },
): Promise<
  | { ok: true; result: SkillsImportResult }
  | { ok: false; status: number; error: string; issues?: unknown }
> {
  const parsed = parseSkillsPackageRaw(raw);
  if (!parsed.ok) {
    return { ok: false, status: 400, error: parsed.error, issues: parsed.issues };
  }

  const seen = new Set<string>();
  for (const item of parsed.skills) {
    const key = packageKey(item);
    if (seen.has(key)) {
      return {
        ok: false,
        status: 400,
        error: `Duplicate skill in package: ${item.slug}`,
      };
    }
    seen.add(key);
  }

  const departments = await prisma.department.findMany();
  const byId = new Map(departments.map((d) => [d.id, d]));
  const bySlug = new Map(departments.map((d) => [d.slug, d]));

  const resolved: Array<{
    item: SkillPackageItem;
    departmentId: string;
  }> = [];
  const missing: Array<{ slug: string; error: string }> = [];

  for (const item of parsed.skills) {
    const dept =
      (item.departmentId ? byId.get(item.departmentId) : undefined) ??
      (item.departmentSlug ? bySlug.get(item.departmentSlug) : undefined);
    if (!dept) {
      missing.push({
        slug: item.slug,
        error: `Department not found (${item.departmentSlug ?? item.departmentId})`,
      });
      continue;
    }
    resolved.push({ item, departmentId: dept.id });
  }

  if (missing.length) {
    return {
      ok: false,
      status: 400,
      error: "Department not found for one or more skills",
      issues: missing,
    };
  }

  try {
    const created: SkillDTO[] = [];
    const updated: SkillDTO[] = [];

    await prisma.$transaction(async (tx) => {
      for (const { item, departmentId } of resolved) {
        const title = (item.title ?? item.name ?? "").trim();
        const knowledgePaths = knowledgePathsOf(item);

        let existing = item.id
          ? await tx.skill.findUnique({
              where: { id: item.id },
              include: { knowledge: true },
            })
          : null;
        if (!existing) {
          existing = await tx.skill.findUnique({
            where: { departmentId_slug: { departmentId, slug: item.slug } },
            include: { knowledge: true },
          });
        }

        if (existing) {
          const updateBody = {
            title,
            description: item.description,
            status: item.status,
            owner: item.owner,
            reviewGate: item.reviewGate,
            purpose: item.purpose,
            instructions: item.instructions,
            steps: item.steps,
            evidence: item.evidence,
            knowledgePaths,
            departmentId,
            posX: item.posX,
            posY: item.posY,
          };
          const checked = updateSkillSchema.safeParse({
            title: updateBody.title,
            description: updateBody.description,
            status: updateBody.status,
            owner: updateBody.owner,
            reviewGate: updateBody.reviewGate,
            purpose: updateBody.purpose,
            instructions: updateBody.instructions,
            steps: updateBody.steps,
            evidence: updateBody.evidence,
            knowledgePaths: updateBody.knowledgePaths,
            departmentId: updateBody.departmentId,
          });
          if (!checked.success) {
            throw new ImportValidationError(
              `Validation failed for ${item.slug}`,
              checked.error.flatten(),
            );
          }

          if (knowledgePaths) {
            await tx.skillKnowledge.deleteMany({
              where: { skillId: existing.id },
            });
            await tx.skillKnowledge.createMany({
              data: knowledgePaths.map((p, i) => ({
                skillId: existing.id,
                path: p,
                sortOrder: i,
              })),
            });
          }

          const row = await tx.skill.update({
            where: { id: existing.id },
            data: {
              title: checked.data.title,
              description: checked.data.description,
              status: checked.data.status,
              owner: checked.data.owner,
              reviewGate: checked.data.reviewGate,
              purpose: checked.data.purpose,
              instructions: checked.data.instructions,
              stepsJson:
                checked.data.steps !== undefined
                  ? JSON.stringify(checked.data.steps)
                  : undefined,
              evidenceJson:
                checked.data.evidence !== undefined
                  ? JSON.stringify(checked.data.evidence)
                  : undefined,
              departmentId: checked.data.departmentId,
              posX: item.posX === undefined ? undefined : item.posX,
              posY: item.posY === undefined ? undefined : item.posY,
              slug: item.slug,
            },
            include: { knowledge: true },
          });
          updated.push(toSkillDTO(row));
        } else {
          const createBody = {
            departmentId,
            slug: item.slug,
            title,
            description: item.description,
            status: item.status,
            owner: item.owner ?? actor.name,
            reviewGate: item.reviewGate,
            purpose: item.purpose,
            instructions: item.instructions,
            steps: item.steps,
            evidence: item.evidence,
            knowledgePaths,
          };
          const checked = createSkillSchema.safeParse(createBody);
          if (!checked.success) {
            throw new ImportValidationError(
              `Validation failed for ${item.slug}`,
              checked.error.flatten(),
            );
          }

          const row = await tx.skill.create({
            data: {
              departmentId: checked.data.departmentId,
              slug: checked.data.slug,
              title: checked.data.title,
              description: checked.data.description,
              status: checked.data.status,
              owner: checked.data.owner ?? actor.name,
              reviewGate: checked.data.reviewGate,
              purpose: checked.data.purpose ?? "",
              instructions: checked.data.instructions ?? "",
              stepsJson: JSON.stringify(checked.data.steps ?? []),
              evidenceJson: JSON.stringify(checked.data.evidence ?? []),
              posX: item.posX ?? null,
              posY: item.posY ?? null,
              knowledge: {
                create: (checked.data.knowledgePaths ?? []).map((p, i) => ({
                  path: p,
                  sortOrder: i,
                })),
              },
            },
            include: { knowledge: true },
          });
          created.push(toSkillDTO(row));
        }
      }
    });

    const all = [...created, ...updated];
    for (const dto of all) {
      const derived = await deriveSkillStatus(dto);
      if (derived !== dto.status) {
        await prisma.skill.update({
          where: { id: dto.id },
          data: { status: derived },
        });
        dto.status = derived;
      }
    }

    await appendActivity({
      action: "skill.import",
      entityType: "skill",
      entityId: "package",
      summary: `Imported ${created.length} new / ${updated.length} updated skill(s)`,
      actorEmail: actor.email,
      payload: {
        created: created.map((s) => s.slug),
        updated: updated.map((s) => s.slug),
      },
    });

    return {
      ok: true,
      result: {
        created: created.length,
        updated: updated.length,
        skills: all,
      },
    };
  } catch (err) {
    if (err instanceof ImportValidationError) {
      return {
        ok: false,
        status: 400,
        error: err.message,
        issues: err.issues,
      };
    }
    const message = err instanceof Error ? err.message : "Import failed";
    if (message.includes("Unique constraint")) {
      return {
        ok: false,
        status: 409,
        error: "Slug already exists in department",
      };
    }
    return { ok: false, status: 500, error: message };
  }
}

class ImportValidationError extends Error {
  issues: unknown;
  constructor(message: string, issues: unknown) {
    super(message);
    this.name = "ImportValidationError";
    this.issues = issues;
  }
}
