import { prisma } from "@matos/db";
import { resolveKnowledgePath, knowledgeFileExists } from "./knowledge";

export async function createPerformanceInsight(input: {
  publicationId?: string | null;
  summary: string;
  actorEmail: string;
}) {
  const summary = input.summary.trim();
  if (summary.length < 8 || summary.length > 2000) {
    throw new Error("insight summary is out of range");
  }
  if (input.publicationId) {
    const publication = await prisma.deskPublication.findUnique({
      where: { id: input.publicationId },
    });
    if (!publication) throw new Error("publication not found");
  }
  return prisma.contentInsight.create({
    data: {
      publicationId: input.publicationId ?? null,
      summary,
      status: "draft",
    },
  });
}

export async function reviewPerformanceInsight(input: {
  insightId: string;
  actorEmail: string;
}) {
  const insight = await prisma.contentInsight.findUnique({ where: { id: input.insightId } });
  if (!insight) throw new Error("insight not found");
  return prisma.contentInsight.update({
    where: { id: insight.id },
    data: {
      status: "reviewed",
      reviewedBy: input.actorEmail,
      reviewedAt: new Date(),
    },
  });
}

/**
 * Link a reviewed insight to an authored skill and/or knowledge file.
 * Draft insights cannot be linked.
 */
export async function linkReviewedInsight(input: {
  insightId: string;
  skillSlug?: string | null;
  knowledgePath?: string | null;
  actorEmail: string;
}) {
  const insight = await prisma.contentInsight.findUnique({ where: { id: input.insightId } });
  if (!insight) throw new Error("insight not found");
  if (insight.status !== "reviewed") {
    throw new Error("insight must be reviewed before it can link to skills or knowledge");
  }
  let skillSlug: string | null = null;
  if (input.skillSlug) {
    const skill = await prisma.skill.findFirst({ where: { slug: input.skillSlug } });
    if (!skill) throw new Error("skill not found");
    skillSlug = skill.slug;
  }
  let knowledgePath: string | null = null;
  if (input.knowledgePath) {
    const abs = resolveKnowledgePath(input.knowledgePath);
    if (!abs) throw new Error("invalid knowledge path");
    if (!(await knowledgeFileExists(input.knowledgePath))) {
      throw new Error("knowledge file not found");
    }
    knowledgePath = input.knowledgePath.replace(/\\/g, "/");
  }
  if (!skillSlug && !knowledgePath) {
    throw new Error("skill or knowledge link is required");
  }
  return prisma.contentInsight.update({
    where: { id: insight.id },
    data: {
      skillSlug: skillSlug ?? insight.skillSlug,
      knowledgePath: knowledgePath ?? insight.knowledgePath,
      reviewedBy: insight.reviewedBy ?? input.actorEmail,
    },
  });
}
