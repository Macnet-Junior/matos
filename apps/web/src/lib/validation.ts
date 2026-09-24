import { z } from "zod";
import { CONTENT_PLATFORMS } from "./content-platforms";

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

export const updateDeskArtifactSchema = z.object({
  body: z.string().max(40000),
  title: z.string().trim().min(1).max(160).optional(),
});

export const deskReviewSchema = z.object({
  action: z.enum(["approve", "request_changes"]),
  note: z.string().trim().max(2000).optional(),
});

export const deskInboxActionSchema = z.object({
  action: z.enum(["approve", "copied"]),
});
