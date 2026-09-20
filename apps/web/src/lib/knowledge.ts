import type { Dirent } from "node:fs";
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

export function resolveKnowledgePath(
  rel: string,
  base = repoRoot(),
): string | null {
  const cleaned = rel.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!cleaned.startsWith("knowledge/")) return null;
  if (cleaned.includes("..") || cleaned.includes("\0")) return null;
  const abs = path.resolve(base, cleaned);
  const root = path.resolve(base, "knowledge");
  if (!abs.startsWith(root + path.sep) && abs !== root) return null;
  return abs;
}

export async function readKnowledgeFile(
  rel: string,
  base = repoRoot(),
): Promise<{ path: string; content: string } | { error: string }> {
  const abs = resolveKnowledgePath(rel, base);
  if (!abs) return { error: "Invalid knowledge path" };
  try {
    const content = await fs.readFile(abs, "utf8");
    return { path: rel, content };
  } catch {
    return { error: "File not found" };
  }
}

export async function knowledgeFileExists(
  rel: string,
  base = repoRoot(),
): Promise<boolean> {
  const abs = resolveKnowledgePath(rel, base);
  if (!abs) return false;
  try {
    await fs.access(abs);
    return true;
  } catch {
    return false;
  }
}

export async function listKnowledgeMarkdown(
  base = repoRoot(),
): Promise<string[]> {
  const root = path.join(base, "knowledge");
  async function walk(dir: string, prefix: string): Promise<string[]> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const out: string[] = [];
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
        out.push(...(await walk(abs, rel)));
      } else if (entry.name.endsWith(".md") && !entry.name.startsWith(".")) {
        out.push(rel);
      }
    }
    return out;
  }
  return (await walk(root, "knowledge")).sort();
}

const MAX_KNOWLEDGE_FILE_BYTES = 512 * 1024;

export async function writeKnowledgeFile(
  rel: string,
  content: string,
  base = repoRoot(),
): Promise<{ path: string } | { error: string }> {
  if (!rel.toLowerCase().endsWith(".md")) {
    return { error: "Only .md files may be written" };
  }
  if (Buffer.byteLength(content, "utf8") > MAX_KNOWLEDGE_FILE_BYTES) {
    return { error: "File exceeds 512KB limit" };
  }
  const abs = resolveKnowledgePath(rel, base);
  if (!abs) return { error: "Invalid knowledge path" };
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
  return { path: rel };
}

/** knowledge/ paths claimed by a skill (canonical links + evidence URLs). */
export function collectKnowledgeRefs(skill: {
  knowledge: { path: string }[];
  evidence?: { url: string }[];
}): string[] {
  const refs: string[] = [];
  for (const item of skill.knowledge) {
    const rel = item.path.trim();
    if (rel) refs.push(rel);
  }
  for (const item of skill.evidence ?? []) {
    const url = item.url.trim();
    if (url.startsWith("knowledge/")) refs.push(url);
  }
  return [...new Set(refs)];
}

/**
 * Derive display status from content completeness — never from a stored label.
 * - authored: non-empty instructions AND ≥1 knowledge link AND every claimed file exists
 * - missing: a claimed knowledge/evidence path is absent on disk, OR instructions exist with no knowledge links
 * - planned: no instructions yet (honest empty state), including deferred skills
 */
export async function deriveSkillStatus(
  skill: {
    instructions: string;
    knowledge: { path: string }[];
    evidence?: { url: string }[];
    status?: SkillStatus;
  },
  base = repoRoot(),
): Promise<SkillStatus> {
  const hasInstructions = skill.instructions.trim().length > 0;
  const refs = collectKnowledgeRefs(skill);
  const exists = await Promise.all(
    refs.map((rel) => knowledgeFileExists(rel, base)),
  );
  if (exists.some((ok) => !ok)) return "missing";
  if (!hasInstructions) return "planned";
  if (skill.knowledge.length === 0) return "missing";
  return "authored";
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
