import { z } from "zod";
import { CONTENT_PLATFORMS } from "./content-platforms";
import { SOURCE_KINDS } from "./desk/sources";

export const skillStatusSchema = z.enum(["authored", "planned", "missing"]);
export const reviewGateSchema = z.enum(["Cold", "Warm", "Hot"]);

const evidenceLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      (v) =>
        /^https?:\/\//i.test(v) ||
        v.startsWith("/") ||
        v.startsWith("knowledge/"),
      "url must be http(s), absolute path, or knowledge/ path",
    ),
  label: z.string().trim().min(1).max(120),
});

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
    evidence: z.array(evidenceLinkSchema).max(40).optional(),
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
  evidence: z.array(evidenceLinkSchema).max(40).optional(),
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
  evidence: z.array(evidenceLinkSchema).max(40).optional(),
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
  // Share-sheet pastes include a title line. 600 characters rejected those
  // before the YouTube parser could pull the address out, and the panel only
  // showed "Validation failed".
  youtubeUrl: z.string().trim().max(2_000).optional(),
  transcript: z.string().max(200_000).optional(),
});

/**
 * The sources panel shows `error` and ignores Zod's issue tree. These
 * sentences are the 400 body.
 */
export function youtubeSkillRequestError(body: unknown, error: z.ZodError): string {
  if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
    return "That request could not be read. Try again.";
  }
  const issue = error.issues[0];
  if (!issue) return "Check the link or the transcript and try again.";
  const field = String(issue.path[0] ?? "");
  if (field === "youtubeUrl") {
    return issue.code === "too_big"
      ? "That link is too long. Paste just the YouTube address, not the title and description around it."
      : "That is not a YouTube link. Paste the full address from the browser.";
  }
  if (field === "transcript") {
    return issue.code === "too_big"
      ? "That transcript is too long to send. Paste a shorter one, or use the YouTube link."
      : "Paste the transcript or the words from the video. A blank note cannot become a skill.";
  }
  if (field === "title") {
    return "That title is too long. Keep it under 160 characters.";
  }
  if (field === "jobId") {
    return "Open a desk job, then paste the link again.";
  }
  return "Check the link or the transcript and try again.";
}

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
