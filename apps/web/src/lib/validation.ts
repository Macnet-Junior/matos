import { z, type ZodError, type ZodIssue } from "zod";
import { CONTENT_PLATFORMS } from "./content-platforms";
import { SOURCE_KINDS } from "./desk/sources";

export const skillStatusSchema = z.enum(["authored", "planned", "missing"]);
export const reviewGateSchema = z.enum(["Cold", "Warm", "Hot"]);

const EVIDENCE_ADDRESS_WHY =
  "must be a web link (example: https://etsy.com/listing/123) or a knowledge file path (example: knowledge/brand/voice.md)";

/** A filename with a dot is not a web address. */
const EVIDENCE_FILE_EXT =
  /\.(md|markdown|txt|json|png|jpe?g|gif|webp|pdf|csv|html?)$/i;

/**
 * `www.etsy.com/listing/123` is a real link. Requiring `https://` up front
 * rejected it on save and only reported "Validation failed".
 * knowledge/ paths and site paths that start with / are left as written.
 */
export function normalizeEvidenceUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return value;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("knowledge/") || value.startsWith("/")) return value;
  if (/\s/.test(value) || value.includes("\\")) return value;
  if (!isBareWebAddress(value)) return value;
  return `https://${value}`;
}

function isBareWebAddress(value: string): boolean {
  if (
    !/^(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#]\S*)?$/i.test(
      value,
    )
  ) {
    return false;
  }
  const hasPath = /[/?#]/.test(value);
  if (!hasPath && !/^www\./i.test(value) && EVIDENCE_FILE_EXT.test(value)) {
    return false;
  }
  return true;
}

const evidenceLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .transform(normalizeEvidenceUrl)
    .pipe(
      z
        .string()
        .max(2000)
        .refine(
          (v) =>
            /^https?:\/\//i.test(v) ||
            v.startsWith("/") ||
            v.startsWith("knowledge/"),
          EVIDENCE_ADDRESS_WHY,
        ),
    ),
  label: z.string().trim().min(1).max(120),
});

function coerceEvidenceItem(item: unknown): unknown {
  if (typeof item !== "string") return item;
  const trimmed = item.trim();
  return { url: trimmed, label: trimmed.slice(0, 120) };
}

/**
 * Evidence on create, update, and package import.
 * Older rows stored a plain string; reading already accepts that shape,
 * so saving it back has to accept it too.
 */
export const evidenceListSchema = z.preprocess((val) => {
  if (!Array.isArray(val)) return val;
  return val.map(coerceEvidenceItem);
}, z.array(evidenceLinkSchema).max(40).optional());

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(2).max(240),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  summary: z.string().trim().min(2).max(240).optional(),
  expanded: z.boolean().optional(),
});

export const knowledgePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (p) =>
      p.startsWith("knowledge/") &&
      !p.includes("..") &&
      !p.includes("\\") &&
      !p.includes("\0"),
    "knowledge path must stay under knowledge/",
  );

export const skillPackageItemSchema = z
  .object({
    id: z.string().trim().min(1).max(80).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
    title: z.string().trim().min(2).max(100).optional(),
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().min(2).max(400),
    departmentId: z.string().trim().min(1).optional(),
    departmentSlug: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "departmentSlug must be kebab-case")
      .optional(),
    departmentName: z.string().trim().max(80).optional(),
    status: skillStatusSchema.optional(),
    owner: z.string().trim().min(1).max(80).optional(),
    reviewGate: reviewGateSchema.optional(),
    purpose: z.string().trim().max(500).optional(),
    instructions: z.string().trim().max(8000).optional(),
    steps: z.array(z.string().trim().min(1).max(400)).max(40).optional(),
    evidence: evidenceListSchema,
    knowledgePaths: z.array(knowledgePathSchema).max(20).optional(),
    knowledge: z
      .array(
        z.object({
          path: knowledgePathSchema,
          title: z.string().trim().max(120).nullable().optional(),
          sortOrder: z.number().int().optional(),
        }),
      )
      .max(20)
      .optional(),
    posX: z.number().finite().nullable().optional(),
    posY: z.number().finite().nullable().optional(),
  })
  .refine((v) => Boolean(v.title?.trim() || v.name?.trim()), {
    message: "title or name is required",
  })
  .refine((v) => Boolean(v.departmentId || v.departmentSlug), {
    message: "departmentId or departmentSlug is required",
  });

export const skillsPackageSchema = z.object({
  format: z.literal("matos-skills").optional(),
  version: z.number().int().positive().max(1).optional(),
  exportedAt: z.string().optional(),
  exportedBy: z.string().optional(),
  count: z.number().int().nonnegative().optional(),
  skills: z.array(skillPackageItemSchema).min(1).max(500),
});

export const createSkillSchema = z.object({
  departmentId: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().min(2).max(400),
  status: skillStatusSchema.default("planned"),
  owner: z.string().trim().min(1).max(80).optional(),
  reviewGate: reviewGateSchema.default("Warm"),
  purpose: z.string().trim().max(500).optional(),
  instructions: z.string().trim().max(8000).optional(),
  steps: z.array(z.string().trim().min(1).max(400)).max(40).optional(),
  evidence: evidenceListSchema,
  knowledgePaths: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .optional(),
});

export const updateSkillSchema = z.object({
  title: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().min(2).max(400).optional(),
  status: skillStatusSchema.optional(),
  owner: z.string().trim().min(1).max(80).optional(),
  reviewGate: reviewGateSchema.optional(),
  purpose: z.string().trim().max(500).optional(),
  instructions: z.string().trim().max(8000).optional(),
  steps: z.array(z.string().trim().min(1).max(400)).max(40).optional(),
  evidence: evidenceListSchema,
  knowledgePaths: z
    .array(z.string().trim().min(1).max(200))
    .max(20)
    .optional(),
  departmentId: z.string().trim().min(1).optional(),
});

export const layoutSchema = z.object({
  company: z
    .object({
      id: z.string(),
      posX: z.number().finite(),
      posY: z.number().finite(),
    })
    .optional(),
  departments: z
    .array(
      z.object({
        id: z.string(),
        posX: z.number().finite(),
        posY: z.number().finite(),
        expanded: z.boolean().optional(),
      }),
    )
    .optional(),
  skills: z
    .array(
      z.object({
        id: z.string(),
        posX: z.number().finite().nullable(),
        posY: z.number().finite().nullable(),
      }),
    )
    .optional(),
});

export const autoArrangeSchema = z.object({
  expandAll: z.boolean().optional(),
});

export { evidenceLinkSchema };

const FIELD_NAMES: Record<string, string> = {
  title: "Title",
  description: "Description",
  status: "Status",
  owner: "Owner",
  reviewGate: "Review gate",
  purpose: "Purpose",
  instructions: "Instructions",
  steps: "Steps",
  evidence: "Evidence",
  knowledgePaths: "Knowledge paths",
  departmentId: "Department",
  slug: "Slug",
  name: "Name",
  summary: "Summary",
  departmentSlug: "Department slug",
};

const CUSTOM_WHY: Record<string, string> = {
  [EVIDENCE_ADDRESS_WHY]: EVIDENCE_ADDRESS_WHY,
  "slug must be kebab-case":
    "must use lowercase letters, numbers, and dashes only",
  "departmentSlug must be kebab-case":
    "must use lowercase letters, numbers, and dashes only",
  "knowledge path must stay under knowledge/":
    "must start with knowledge/ and stay inside that folder",
  "title or name is required": "needs a title",
  "departmentId or departmentSlug is required": "needs a department",
};

function fieldName(path: Array<string | number>): string {
  if (path[0] === "skills" && typeof path[1] === "number") {
    const rest = path.slice(2);
    if (rest.length === 0) return `Skill ${path[1] + 1}`;
    return `${fieldName(rest)} on skill ${path[1] + 1}`;
  }
  if (path[0] === "evidence") {
    if (typeof path[1] !== "number") return "Evidence";
    const n = path[1] + 1;
    if (path[2] === "url") return `Evidence link ${n} address`;
    if (path[2] === "label") return `Evidence link ${n} label`;
    return `Evidence link ${n}`;
  }
  if (path[0] === "steps" && typeof path[1] === "number") {
    return `Step ${path[1] + 1}`;
  }
  if (path[0] === "knowledgePaths") {
    if (typeof path[1] === "number") return `Knowledge path ${path[1] + 1}`;
    return "Knowledge paths";
  }
  if (path[0] === "knowledge" && typeof path[1] === "number") {
    return `Knowledge file ${path[1] + 1}`;
  }
  const head = typeof path[0] === "string" ? path[0] : "";
  if (!head) return "This form";
  return FIELD_NAMES[head] ?? head;
}

function why(issue: ZodIssue): string {
  if (issue.code === "too_small") {
    if (issue.type === "string") {
      const n = Number(issue.minimum);
      return `needs at least ${n} ${n === 1 ? "character" : "characters"}`;
    }
    if (issue.type === "array") {
      const n = Number(issue.minimum);
      return `needs at least ${n} ${n === 1 ? "item" : "items"}`;
    }
    return "is too small";
  }
  if (issue.code === "too_big") {
    if (issue.type === "string") {
      const n = Number(issue.maximum);
      return `must be ${n} ${n === 1 ? "character" : "characters"} or fewer`;
    }
    if (issue.type === "array") {
      const n = Number(issue.maximum);
      return `can have at most ${n} ${n === 1 ? "item" : "items"}`;
    }
    return "is too long";
  }
  if (issue.code === "invalid_enum_value") {
    return `must be one of: ${issue.options.join(", ")}`;
  }
  if (issue.code === "invalid_type") {
    if (issue.received === "undefined" || issue.received === "null") {
      return "is required";
    }
    return "is in the wrong format";
  }
  const mapped = CUSTOM_WHY[issue.message];
  if (mapped) return mapped;
  const text = issue.message.replace(/\.$/, "");
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function sentenceFor(issue: ZodIssue): string {
  if (issue.path.length === 0) {
    const text = issue.message.replace(/\.$/, "");
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
  }
  return `${fieldName(issue.path)} ${why(issue)}.`;
}

/** One plain sentence per field. Used by every skill save that shares this schema. */
export function formatValidationError(error: ZodError): string {
  const unique: ZodIssue[] = [];
  const seen = new Set<string>();
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(issue);
  }
  if (unique.length === 0) return "Check the form and try again.";
  const shown = unique.slice(0, 8).map(sentenceFor);
  const rest = unique.length - shown.length;
  const tail =
    rest > 0
      ? ` ${rest} more ${rest === 1 ? "problem" : "problems"} on this form.`
      : "";
  return `${shown.join(" ")}${tail}`;
}

export const contentGateSchema = z.enum([
  "draft",
  "warm",
  "approved",
  "scheduled",
  "published",
]);

export const createWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
  description: z.string().trim().max(500).optional(),
  skillIds: z.array(z.string().trim().min(1)).min(1).max(20),
});

export const updateWorkflowSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  skillIds: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
  gateState: contentGateSchema.optional(),
});

export const advanceGateSchema = z.object({
  to: contentGateSchema,
});


export const deskChannelSchema = z.enum(CONTENT_PLATFORMS);

export const createDeskBriefSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  topic: z.string().trim().min(2).max(240),
  audience: z.string().trim().min(2).max(240),
  offerCta: z.string().trim().min(2).max(240),
  channels: z.array(deskChannelSchema).min(1).max(CONTENT_PLATFORMS.length),
  dueAt: z.string().datetime().optional().nullable(),
});

export const createDeskSourceSchema = z.object({
  kind: z.enum(SOURCE_KINDS),
  title: z.string().trim().min(2).max(160),
  // The origin is deliberately loose. It is a URL for a video, a path for an
  // upload, or the owner's own description of where a call came from — the
  // three cannot share a shape, and rejecting a free-form origin would push
  // the owner to invent a URL for material that has none.
  origin: z.string().trim().min(1).max(600),
  jobId: z.string().trim().min(1).max(64).optional().nullable(),
});

export const youtubeSkillSchema = z.object({
  jobId: z.string().trim().min(1).max(64),
  title: z.string().trim().max(160).optional(),
  youtubeUrl: z.string().trim().max(600).optional(),
  transcript: z.string().max(100_000).optional(),
});

export const ingestDeskSourceSchema = z.object({
  // A file path on the machine the desk runs on. The route does not accept a
  // URL here: fetching a remote file at ingest time is a different decision
  // (what may the desk reach out to) and is not made by this field.
  filePath: z.string().trim().min(1).max(600),
});

export const updateDeskArtifactSchema = z.object({
  body: z.string().max(40000),
  title: z.string().trim().min(1).max(160).optional(),
});

export const deskReviewSchema = z.object({
  action: z.enum(["approve", "request_changes"]),
  note: z.string().trim().max(2000).optional(),
  /**
   * The desk stage the artifact under review was produced by. Required for
   * `request_changes` because the whole value of a rejection is the loop back
   * to the authored skill that caused it, and the API route can no longer
   * recover the stage once the caller has moved on.
   *
   * Left optional in the schema so `approve` does not have to send it; the
   * route enforces it per-action where the requirement actually is.
   */
  stage: z
    .enum(["scout", "ghost", "editor", "press", "clock", "echo"])
    .optional(),
});

export const deskInboxActionSchema = z.object({
  action: z.enum(["approve", "copied"]),
});
