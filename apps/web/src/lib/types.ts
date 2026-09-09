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

export interface EvidenceLinkDTO {
  url: string;
  label: string;
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
  evidence: EvidenceLinkDTO[];
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

export type MatosRole = "Owner" | "Operator" | "Author" | "Viewer";

export interface MapCapabilities {
  canManageMap: boolean;
  canEditSkills: boolean;
  canManageWorkflows: boolean;
  canRunWorkflows: boolean;
  canApprove: boolean;
  canExportActivity: boolean;
}

export interface MapPayload {
  company: CompanyDTO;
  departments: DepartmentDTO[];
  stats: MapStats;
  /** @deprecated Prefer role / capabilities — true when role === Owner */
  isOwner: boolean;
  role: MatosRole;
  capabilities: MapCapabilities;
}

export type EncodingCheckId =
  | "purpose"
  | "steps"
  | "reviewGate"
  | "knowledge";

export interface EncodingCheck {
  id: EncodingCheckId;
  label: string;
  pass: boolean;
  detail: string;
}

export interface SkillEncodingResult {
  skillId: string;
  slug: string;
  title: string;
  department: string;
  status: SkillStatus;
  checks: EncodingCheck[];
  pass: boolean;
}

/** Content review gate for workflows / runs (Phase 3). */
export type ContentGate =
  | "draft"
  | "warm"
  | "approved"
  | "scheduled"
  | "published";

export type WorkflowRunStatus =
  | "running"
  | "completed"
  | "failed"
  | "blocked";

export type RunStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "blocked";

export interface WorkflowStepDTO {
  id: string;
  workflowId: string;
  skillId: string;
  skillSlug: string;
  skillTitle: string;
  skillStatus: SkillStatus;
  skillReviewGate: ReviewGate;
  sortOrder: number;
  label: string | null;
}

export interface WorkflowDTO {
  id: string;
  slug: string;
  name: string;
  description: string;
  gateState: ContentGate;
  steps: WorkflowStepDTO[];
  createdAt: string;
  updatedAt: string;
  runCount?: number;
  lastRun?: WorkflowRunSummaryDTO | null;
}

export interface WorkflowRunSummaryDTO {
  id: string;
  workflowId: string;
  workflowName?: string;
  status: WorkflowRunStatus;
  gateState: ContentGate;
  dryRun: boolean;
  summary: string;
  startedAt: string;
  finishedAt: string | null;
  actorEmail: string | null;
}

export interface RunStepDTO {
  id: string;
  runId: string;
  workflowStepId: string | null;
  skillId: string;
  skillSlug: string;
  skillTitle: string;
  sortOrder: number;
  status: RunStepStatus;
  gateState: ContentGate;
  logs: unknown[];
  artifact: Record<string, unknown>;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface WorkflowRunDTO extends WorkflowRunSummaryDTO {
  artifact: Record<string, unknown>;
  steps: RunStepDTO[];
  workflowSlug?: string;
}

export interface HomeDigestDTO {
  pendingGates: Array<{
    kind: "workflow" | "run";
    id: string;
    name: string;
    gateState: ContentGate;
    href: string;
  }>;
  recentActivity: ActivityDTO[];
  lastRun: WorkflowRunSummaryDTO | null;
  workflowCount: number;
  runCount: number;
}

export type ChannelProvider = "late-dev" | "etsy" | "whatsapp";
export type ChannelStatus = "connected" | "disconnected" | "error";

export type CoverageCell = "ready" | "handoff" | "gated" | "disconnected" | "available" | "n/a" | "yes";

export interface ChannelCoverage {
  api: CoverageCell;
  scheduled: CoverageCell;
  handoff: CoverageCell;
  disconnected: CoverageCell;
}

/** @deprecated Use ChannelDTO */
export interface ChannelStubDTO {
  id: string;
  name: string;
  status: ChannelStatus;
  note: string;
  phase: string;
}

export interface ChannelDTO {
  id: ChannelProvider;
  name: string;
  status: ChannelStatus;
  note: string;
  phase: string;
  connectMode: "api_key" | "oauth" | "env";
  maskedHint: string | null;
  lastError: string | null;
  externalId: string | null;
  meta: Record<string, unknown>;
  coverage: ChannelCoverage;
  allowedDestination: { id: string | null; label: string } | null;
}
