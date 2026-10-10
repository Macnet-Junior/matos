import { prisma } from "@matos/db";
import {
  activityActionLabel,
  activityHref,
  type ActivityTargetInput,
  type ActivityTargetResolved,
} from "@/lib/activity-target";
import type { ActivityDTO } from "@/lib/types";

export type PresentedActivity = {
  id: string;
  summary: string;
  actionLabel: string;
  href: string | null;
  actorEmail: string | null;
  createdAt: string;
};

function unique(ids: Iterable<string>): string[] {
  return [...new Set([...ids].filter((id) => id.trim().length > 0))];
}

async function existingIds(
  ids: string[],
  load: (ids: string[]) => Promise<{ id: string }[]>,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await load(ids);
  return new Set(rows.map((row) => row.id));
}

/**
 * Attach a plain action label and a real href to each event.
 * Looks up skills, jobs, sources, and publications so a deleted row is not a link.
 */
export async function presentActivity(
  events: ActivityDTO[],
): Promise<PresentedActivity[]> {
  const skillIds = unique(
    events
      .filter((event) => event.entityType === "skill" && event.entityId !== "package")
      .map((event) => event.entityId),
  );
  const sourceIds = unique(
    events
      .filter((event) => event.entityType === "desk_source")
      .map((event) => event.entityId),
  );
  const publicationIds = unique(
    events
      .filter((event) => event.entityType === "desk_publication")
      .map((event) => event.entityId),
  );
  const workflowIds = unique(
    events
      .filter(
        (event) =>
          event.entityType === "workflow" && event.action !== "workflow.delete",
      )
      .map((event) => event.entityId),
  );
  const runIds = unique(
    events
      .filter((event) => event.entityType === "workflow_run")
      .map((event) => event.entityId),
  );
  const directJobIds = unique(
    events
      .filter((event) => event.entityType === "desk_job")
      .map((event) => event.entityId),
  );

  const [skills, sources, publications, workflows, runs, directJobs] =
    await Promise.all([
      skillIds.length
        ? prisma.skill.findMany({
            where: { id: { in: skillIds } },
            select: { id: true, slug: true },
          })
        : Promise.resolve([]),
      sourceIds.length
        ? prisma.deskSource.findMany({
            where: { id: { in: sourceIds } },
            select: { id: true, jobId: true },
          })
        : Promise.resolve([]),
      publicationIds.length
        ? prisma.deskPublication.findMany({
            where: { id: { in: publicationIds } },
            select: { id: true, jobId: true },
          })
        : Promise.resolve([]),
      existingIds(workflowIds, (ids) =>
        prisma.workflow.findMany({ where: { id: { in: ids } }, select: { id: true } }),
      ),
      existingIds(runIds, (ids) =>
        prisma.workflowRun.findMany({
          where: { id: { in: ids } },
          select: { id: true },
        }),
      ),
      existingIds(directJobIds, (ids) =>
        prisma.deskJob.findMany({ where: { id: { in: ids } }, select: { id: true } }),
      ),
    ]);

  const skillSlug = new Map(skills.map((skill) => [skill.id, skill.slug]));
  const sourceJob = new Map(sources.map((source) => [source.id, source.jobId]));
  const publicationJob = new Map(
    publications.map((publication) => [publication.id, publication.jobId]),
  );

  const relatedJobIds = unique([
    ...sources.map((source) => source.jobId ?? ""),
    ...publications.map((publication) => publication.jobId),
  ]);
  const relatedJobs = await existingIds(relatedJobIds, (ids) =>
    prisma.deskJob.findMany({ where: { id: { in: ids } }, select: { id: true } }),
  );

  return events.map((event) => {
    const resolved = resolveOne(event, {
      skillSlug,
      sourceJob,
      publicationJob,
      workflows,
      runs,
      directJobs,
      relatedJobs,
    });
    return {
      id: event.id,
      summary: event.summary,
      actionLabel: activityActionLabel(event.action),
      href: activityHref(event, resolved),
      actorEmail: event.actorEmail,
      createdAt: event.createdAt,
    };
  });
}

function resolveOne(
  event: ActivityTargetInput,
  maps: {
    skillSlug: Map<string, string>;
    sourceJob: Map<string, string | null>;
    publicationJob: Map<string, string>;
    workflows: Set<string>;
    runs: Set<string>;
    directJobs: Set<string>;
    relatedJobs: Set<string>;
  },
): ActivityTargetResolved | undefined {
  switch (event.entityType) {
    case "skill":
      if (event.entityId === "package") return undefined;
      return { skillSlug: maps.skillSlug.get(event.entityId) ?? null };
    case "desk_job":
      return { exists: maps.directJobs.has(event.entityId) };
    case "workflow":
      if (event.action === "workflow.delete") return { exists: false };
      return { exists: maps.workflows.has(event.entityId) };
    case "workflow_run":
      return { exists: maps.runs.has(event.entityId) };
    case "desk_source": {
      if (!maps.sourceJob.has(event.entityId)) return { jobId: null, exists: false };
      const jobId = maps.sourceJob.get(event.entityId) ?? null;
      return { jobId, exists: Boolean(jobId && maps.relatedJobs.has(jobId)) };
    }
    case "desk_publication": {
      const jobId = maps.publicationJob.get(event.entityId) ?? null;
      if (!jobId) return { jobId: null, exists: false };
      return { jobId, exists: maps.relatedJobs.has(jobId) };
    }
    default:
      return undefined;
  }
}
