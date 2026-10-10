/**
 * Where an activity row goes, and the words shown instead of an action code.
 *
 * The href is derived from the event's entity. A missing or deleted subject
 * returns null so the row stays plain text — a row with no destination must
 * not look clickable.
 */

export type ActivityTargetInput = {
  action: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
};

export type ActivityTargetResolved = {
  /** Skill slug when the entity is a skill id. Null means the skill is gone. */
  skillSlug?: string | null;
  /** Desk job that owns a source or publication. */
  jobId?: string | null;
  /** False when the detail page for this entity would 404. */
  exists?: boolean;
};

const ACTION_LABELS: Record<string, string> = {
  seed: "Workspace seeded",
  "desk.brief.create": "Desk brief created",
  "desk.stage.run": "Desk stage ran",
  "desk.artifact.edit": "Desk draft edited",
  "desk.stage.changes": "Changes requested",
  "desk.job.filed": "Desk job filed",
  "desk.stage.approve": "Desk stage approved",
  "desk.job.approve": "Desk job approved",
  "desk.inbox.approve": "Inbox draft approved",
  "desk.inbox.copied": "Inbox draft copied",
  "desk.schedule.delivery_failed": "Scheduled delivery failed",
  "desk.schedule.ran": "Scheduler ran",
  "desk.source.ingested": "Source read",
  "desk.source.skill_drafted": "Skill drafted from a source",
  "desk.publication.completed": "Publication finished",
  "desk.publication.reconciled": "Publication checked",
  "skill.import": "Skills imported",
  "skill.export": "Skills exported",
  "skill.create": "Skill created",
  "skill.update": "Skill updated",
  "workflow.create": "Workflow created",
  "workflow.update": "Workflow updated",
  "workflow.delete": "Workflow deleted",
  "workflow.run": "Workflow dry-run",
  "workflow.approve": "Workflow gate advanced",
  "knowledge.export": "Knowledge exported",
  "knowledge.import": "Knowledge imported",
  "department.create": "Department created",
  "department.update": "Department updated",
  "layout.update": "Map layout saved",
  "layout.auto_arrange": "Map arranged",
  "channel.disconnect": "Channel disconnected",
  "channel.connect": "Channel connected",
  "whatsapp.send": "WhatsApp message handled",
  "support.ticket.create": "Support ticket opened",
  "support.ticket.update": "Support ticket updated",
  "support.chat": "Support chat",
  "auto-response.approve": "Auto-response approved",
  "auto-response.create": "Auto-response created",
  "auto-response.enable": "Auto-response enabled",
  "auto-response.disable": "Auto-response disabled",
  "auto-response.attempt": "Auto-response tried",
  "auth.login": "Signed in",
  "credit.grant": "Credits granted",
  "credit.consume": "Credits used",
  "credit.adjust": "Credits adjusted",
};

const PAST_VERBS: Record<string, string> = {
  approve: "approved",
  create: "created",
  update: "updated",
  delete: "deleted",
  run: "ran",
  connect: "connected",
  disconnect: "disconnected",
  export: "exported",
  import: "imported",
  edit: "edited",
  send: "sent",
  login: "signed in",
  filed: "filed",
  copied: "copied",
  enable: "enabled",
  disable: "disabled",
  attempt: "tried",
  ingested: "read",
  reconciled: "checked",
  completed: "finished",
  failed: "failed",
};

/** Plain words for an action code. Never returns the dotted code itself. */
export function activityActionLabel(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  if (action.startsWith("usage.")) return "Usage recorded";
  if (action.startsWith("credit.")) {
    const kind = action.slice("credit.".length);
    if (kind === "grant") return "Credits granted";
    if (kind === "consume") return "Credits used";
    if (kind === "adjust") return "Credits adjusted";
    return "Credits updated";
  }
  const parts = action.split(/[._-]/).filter(Boolean);
  if (parts.length === 0) return "Activity";
  const verb = parts[parts.length - 1] ?? "updated";
  const past = PAST_VERBS[verb] ?? verb;
  const head = parts
    .slice(0, -1)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = `${head} ${past}`.trim();
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

/** A knowledge/ path that is safe to put in a query string. */
export function safeKnowledgePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned.startsWith("knowledge/")) return null;
  if (cleaned.includes("..") || cleaned.includes("\0") || cleaned.includes("?")) {
    return null;
  }
  return cleaned;
}

export function knowledgePageHref(path: string): string | null {
  const safe = safeKnowledgePath(path);
  if (!safe) return null;
  return `/knowledge?path=${encodeURIComponent(safe)}`;
}

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function knowledgePathFrom(event: ActivityTargetInput): string | null {
  const payload = event.payload ?? {};
  const direct =
    safeKnowledgePath(payload.path) ??
    safeKnowledgePath(payload.knowledgePath) ??
    safeKnowledgePath(event.entityId);
  if (direct) return direct;
  const written = payload.written;
  if (Array.isArray(written) && written.length === 1) {
    return safeKnowledgePath(written[0]);
  }
  return null;
}

function skillSlugFrom(
  event: ActivityTargetInput,
  resolved?: ActivityTargetResolved,
): string | null {
  if (resolved && "skillSlug" in resolved) return resolved.skillSlug ?? null;
  const slug = payloadString(event.payload ?? {}, "slug");
  if (!slug || slug.includes("/") || slug.includes("..")) return null;
  return slug;
}

/**
 * Route for this event, or null when there is nothing real to open.
 * `resolved.exists === false` suppresses links that would 404.
 */
export function activityHref(
  event: ActivityTargetInput,
  resolved?: ActivityTargetResolved,
): string | null {
  const payload = event.payload ?? {};
  const entityId = event.entityId.trim();
  const jobFromPayload = payloadString(payload, "jobId");
  const gone = resolved?.exists === false;

  switch (event.entityType) {
    case "desk_job":
      if (!entityId || gone) return null;
      return `/desk/${entityId}`;
    case "workflow":
      if (event.action === "workflow.delete" || !entityId || gone) return null;
      return `/workflows/${entityId}`;
    case "workflow_run":
      if (!entityId || gone) return null;
      return `/workflows/runs/${entityId}`;
    case "skill": {
      if (entityId === "package") return "/skills";
      const slug = skillSlugFrom(event, resolved);
      if (!slug) return null;
      return `/map?skill=${encodeURIComponent(slug)}`;
    }
    case "knowledge": {
      const path = knowledgePathFrom(event);
      if (path) return knowledgePageHref(path);
      return "/knowledge";
    }
    case "desk_source": {
      const jobId = resolved?.jobId ?? jobFromPayload;
      if (!jobId || gone) return null;
      return `/desk/${jobId}`;
    }
    case "desk_publication": {
      const jobId = resolved?.jobId ?? jobFromPayload;
      if (jobId && !gone) return `/desk/${jobId}`;
      return "/ops/content";
    }
    case "desk_calendar_item":
    case "desk_schedule":
      return "/calendar";
    case "desk_inbox":
      return "/inbox";
    case "department":
    case "map":
    case "company":
      return "/map";
    case "support_ticket":
      return "/support";
    case "chat_thread":
      return "/support/chat";
    case "auto_response":
      return "/ops/auto-response";
    case "credit":
      return "/ops/billing";
    case "usage":
      return "/ops/usage";
    case "user":
      return "/ops/presence";
    case "integration":
      return "/settings/channels";
    default:
      return null;
  }
}
