import { notFound } from "next/navigation";
import { prisma } from "@matos/db";
import { getSessionFlags } from "@/lib/owner";
import { getWorkflow, toRunSummaryDTO } from "@/lib/workflows";
import { toSkillDTO } from "@/lib/map-data";
import { WorkflowDetail } from "@/components/WorkflowDetail";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function Page({ params }: Props) {
  const { id } = await params;
  const { canManageWorkflows, canRunWorkflows, canApprove } =
    await getSessionFlags();
  const workflow = await getWorkflow(id);
  if (!workflow) notFound();

  const runRows = await prisma.workflowRun.findMany({
    where: { workflowId: id },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  const runs = runRows.map((r) => toRunSummaryDTO(r, workflow.name));

  const skillRows = await prisma.skill.findMany({
    include: { knowledge: true },
    orderBy: { slug: "asc" },
  });
  const skills = skillRows.map(toSkillDTO);

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="overflow-auto p-[22px]">
        <WorkflowDetail
          workflow={workflow}
          runs={runs}
          skills={skills}
          canManageWorkflows={canManageWorkflows}
          canRunWorkflows={canRunWorkflows}
          canApprove={canApprove}
        />
      </div>
    </main>
  );
}
