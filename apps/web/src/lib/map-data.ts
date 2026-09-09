import {
  parseEvidenceLinks,
  parseJsonArray,
  parseJsonObject,
  prisma,
  type Department,
  type Skill,
  type SkillKnowledge,
} from "@matos/db";
import type {
  ActivityDTO,
  CompanyDTO,
  DepartmentDTO,
  MapPayload,
  SkillDTO,
  SkillStatus,
  ReviewGate,
} from "./types";
import { computeStats } from "./map-layout";
import { reconcileSkillStatuses, withDerivedStatuses } from "./knowledge";

export { computeStats, computeAutoArrange } from "./map-layout";

type SkillRow = Skill & { knowledge: SkillKnowledge[] };
type DeptRow = Department & { skills: SkillRow[] };

function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? "macnet@matos.local").trim().toLowerCase();
}

function asStatus(value: string): SkillStatus {
  if (value === "authored" || value === "planned" || value === "missing") {
    return value;
  }
  return "planned";
}

function asGate(value: string): ReviewGate {
  if (value === "Cold" || value === "Warm" || value === "Hot") return value;
  return "Warm";
}

export function toSkillDTO(skill: SkillRow): SkillDTO {
  return {
    id: skill.id,
    departmentId: skill.departmentId,
    slug: skill.slug,
    title: skill.title,
    description: skill.description,
    status: asStatus(skill.status),
    owner: skill.owner,
    reviewGate: asGate(skill.reviewGate),
    purpose: skill.purpose,
    instructions: skill.instructions,
    steps: parseJsonArray(skill.stepsJson),
    evidence: parseEvidenceLinks(skill.evidenceJson),
    knowledge: skill.knowledge
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((k) => ({
        id: k.id,
        path: k.path,
        title: k.title,
        sortOrder: k.sortOrder,
      })),
    posX: skill.posX,
    posY: skill.posY,
  };
}

export function toDepartmentDTO(dept: DeptRow): DepartmentDTO {
  return {
    id: dept.id,
    companyId: dept.companyId,
    slug: dept.slug,
    name: dept.name,
    summary: dept.summary,
    sortOrder: dept.sortOrder,
    posX: dept.posX,
    posY: dept.posY,
    expanded: dept.expanded,
    skills: dept.skills
      .slice()
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(toSkillDTO),
  };
}

export async function loadMapPayload(
  viewerEmail?: string | null,
  opts?: { reconcile?: boolean },
): Promise<MapPayload> {
  const company = await prisma.company.findFirst({
    include: {
      departments: {
        orderBy: { sortOrder: "asc" },
        include: {
          skills: {
            include: { knowledge: true },
          },
        },
      },
    },
  });

  if (!company) {
    throw new Error("Company not seeded — run pnpm db:seed");
  }

  const companyDTO: CompanyDTO = {
    id: company.id,
    name: company.name,
    summary: company.summary,
    posX: company.posX,
    posY: company.posY,
  };

  const baseDepartments = company.departments.map(toDepartmentDTO);
  const allSkills = baseDepartments.flatMap((d) => d.skills);

  // Optionally sync DB status with derived Authored/Planned/Missing.
  if (opts?.reconcile !== false) {
    await reconcileSkillStatuses(allSkills);
  }

  const departments = await Promise.all(
    baseDepartments.map(async (d) => ({
      ...d,
      skills: await withDerivedStatuses(d.skills),
    })),
  );
  const email = viewerEmail?.trim().toLowerCase() ?? null;

  return {
    company: companyDTO,
    departments,
    stats: computeStats(departments),
    isOwner: !!email && email === ownerEmail(),
  };
}

export async function appendActivity(input: {
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorEmail?: string | null;
  payload?: Record<string, unknown>;
}) {
  return prisma.activityEvent.create({
    data: {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      actorEmail: input.actorEmail ?? null,
      payloadJson: JSON.stringify(input.payload ?? {}),
    },
  });
}

export function toActivityDTO(row: {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorEmail: string | null;
  payloadJson: string;
  createdAt: Date;
}): ActivityDTO {
  return {
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    summary: row.summary,
    actorEmail: row.actorEmail,
    payload: parseJsonObject(row.payloadJson),
    createdAt: row.createdAt.toISOString(),
  };
}
