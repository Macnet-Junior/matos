import { z } from "zod";

export const skillStatusSchema = z.enum(["authored", "planned", "missing"]);
export const reviewGateSchema = z.enum(["Cold", "Warm", "Hot"]);

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
  evidence: z.array(z.string().trim().min(1).max(400)).max(40).optional(),
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
  evidence: z.array(z.string().trim().min(1).max(400)).max(40).optional(),
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
