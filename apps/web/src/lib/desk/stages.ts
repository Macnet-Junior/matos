export const DESK_STAGES = [
  "scout",
  "ghost",
  "editor",
  "press",
  "clock",
  "echo",
] as const;

export type DeskStage = (typeof DESK_STAGES)[number];

export type DeskJobStatus =
  | "draft"
  | "generating"
  | "awaiting_approval"
  | "changes_requested"
  | "approved"
  | "filed";

export type DeskArtifactReview =
  | "pending"
  | "ready"
  | "approved"
  | "changes_requested";

export type DeskInboxStatus = "drafted" | "approved" | "copied";

export const STAGE_LABELS: Record<DeskStage, string> = {
  scout: "Scout",
  ghost: "Ghost",
  editor: "Editor",
  press: "Press",
  clock: "Clock",
  echo: "Echo",
};

export const STAGE_BLURBS: Record<DeskStage, string> = {
  scout: "Research notes & angles",
  ghost: "First draft",
  editor: "Voice & QA pass",
  press: "Per-channel packs",
  clock: "Schedule on calendar",
  echo: "Drafted inbox replies",
};

export function isDeskStage(value: string): value is DeskStage {
  return (DESK_STAGES as readonly string[]).includes(value);
}

export function stageIndex(stage: DeskStage): number {
  return DESK_STAGES.indexOf(stage);
}

export function nextStage(stage: DeskStage): DeskStage | "filed" {
  const i = stageIndex(stage);
  if (i < 0 || i >= DESK_STAGES.length - 1) return "filed";
  return DESK_STAGES[i + 1]!;
}

export function previousStage(stage: DeskStage): DeskStage | null {
  const i = stageIndex(stage);
  if (i <= 0) return null;
  return DESK_STAGES[i - 1]!;
}

/** Seed/JSON sometimes stores the two-char sequence \n instead of a real newline. */
export function normalizeDeskBody(body: string): string {
  if (!body) return body;
  if (body.includes("\n")) return body;
  if (!body.includes("\\n")) return body;
  return body.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
}
