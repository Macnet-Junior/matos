export type SkillStatus = "authored" | "planned" | "missing";
export type ReviewGate = "Cold" | "Warm" | "Hot";

export interface CompanyDTO {
  id: string;
  name: string;
  summary: string;
  posX: number;
  posY: number;
}

export interface KnowledgeLinkDTO {
  id: string;
  path: string;
  title: string | null;
  sortOrder: number;
}

export interface SkillDTO {
  id: string;
  departmentId: string;
  slug: string;
  title: string;
  description: string;
  status: SkillStatus;
  owner: string;
  reviewGate: ReviewGate;
  purpose: string;
  instructions: string;
  steps: string[];
  evidence: string[];
  knowledge: KnowledgeLinkDTO[];
  posX: number | null;
  posY: number | null;
}

export interface DepartmentDTO {
  id: string;
  companyId: string;
  slug: string;
  name: string;
  summary: string;
  sortOrder: number;
  posX: number;
  posY: number;
  expanded: boolean;
  skills: SkillDTO[];
}

export interface MapStats {
  departmentCount: number;
  authored: number;
  planned: number;
  missing: number;
  skillCount: number;
}

export interface ActivityDTO {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorEmail: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MapPayload {
  company: CompanyDTO;
  departments: DepartmentDTO[];
  stats: MapStats;
  isOwner: boolean;
}
