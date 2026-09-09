import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@matos/db";
import type {
  EncodingCheck,
  SkillDTO,
  SkillEncodingResult,
  SkillStatus,
} from "./types";

/** Repo root: apps/web -> ../.. */
export function repoRoot(): string {
  return path.resolve(process.cwd(), "../..");
}

export function resolveKnowledgePath(rel: string): string | null {
  const cleaned = rel.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!cleaned.startsWith("knowledge/")) return null;
  if (cleaned.includes("..")) return null;
  const abs = path.resolve(repoRoot(), cleaned);
  const root = path.resolve(repoRoot(), "knowledge");
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  return abs;
}

export async function readKnowledgeFile(
  rel: string,
): Promise<{ path: string; content: string } | { error: string }> {
  const abs = resolveKnowledgePath(rel);
  if (!abs) return { error: "Invalid knowledge path" };
  try {
    const content = await fs.readFile(abs, "utf8");
    return { path: rel, content };
  } catch {
    return { error: "File not found" };
  }
}

export async function knowledgeFileExists(rel: string): Promise<boolean> {
  const abs = resolveKnowledgePath(rel);
  if (!abs) return false;
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

/**
 * Derive display status from content completeness.
 * - authored: non-empty instructions AND at least one existing knowledge file
 * - missing: claimed authored/planned but knowledge files absent OR empty instructions with links expected
 * - planned: otherwise
 */
export async function deriveSkillStatus(skill: {
  instructions: string;
  knowledge: { path: string }[];
  status: SkillStatus;
}): Promise<SkillStatus> {
  const hasInstructions = skill.instructions.trim().length > 0;
  const links = skill.knowledge;
  if (!hasInstructions && links.length === 0) {
    return skill.status === "missing" ? "missing" : "planned";
  }
  if (!hasInstructions) return "missing";
  if (links.length === 0) return "missing";
  const exists = await Promise.all(links.map((k) => knowledgeFileExists(k.path)));
  if (exists.every(Boolean)) return "authored";
  return "missing";
}

export async function withDerivedStatuses(
  skills: SkillDTO[],
): Promise<SkillDTO[]> {
  return Promise.all(
    skills.map(async (skill) => ({
      ...skill,
      status: await deriveSkillStatus(skill),
    })),
  );
}

/**
 * Persist derived statuses when they differ from DB so edits stay accurate.
 * Returns number of rows updated.
 */
export async function reconcileSkillStatuses(
  skills: SkillDTO[],
): Promise<number> {
  let updated = 0;
  for (const skill of skills) {
    const derived = await deriveSkillStatus(skill);
    if (derived !== skill.status) {
      await prisma.skill.update({
        where: { id: skill.id },
        data: { status: derived },
      });
      updated += 1;
    }
  }
  return updated;
}

/** Encoding guide checklist: purpose, steps, review gate, ≥1 knowledge link. */
export function evaluateSkillEncoding(
  skill: Pick<
    SkillDTO,
    | "id"
    | "slug"
    | "title"
    | "status"
    | "purpose"
    | "steps"
    | "reviewGate"
    | "knowledge"
  >,
  department: string,
): SkillEncodingResult {
  const checks: EncodingCheck[] = [
    {
      id: "purpose",
      label: "Purpose",
      pass: skill.purpose.trim().length > 0,
      detail:
        skill.purpose.trim().length > 0
          ? "Purpose present"
          : "Add a one-sentence purpose",
    },
    {
      id: "steps",
      label: "Steps",
      pass: skill.steps.length > 0,
      detail:
        skill.steps.length > 0
          ? `${skill.steps.length} step(s)`
          : "Add at least one ordered step",
    },
    {
      id: "reviewGate",
      label: "Review gate",
      pass:
        skill.reviewGate === "Cold" ||
        skill.reviewGate === "Warm" ||
        skill.reviewGate === "Hot",
      detail: `Gate: ${skill.reviewGate}`,
    },
    {
      id: "knowledge",
      label: "Knowledge link",
      pass: skill.knowledge.length >= 1,
      detail:
        skill.knowledge.length >= 1
          ? `${skill.knowledge.length} link(s)`
          : "Link ≥1 knowledge/ file",
    },
  ];

  return {
    skillId: skill.id,
    slug: skill.slug,
    title: skill.title,
    department,
    status: skill.status,
    checks,
    pass: checks.every((c) => c.pass),
  };
}
