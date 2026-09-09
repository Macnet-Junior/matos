import { prisma } from "@matos/db";
import { getSessionFlags } from "@/lib/owner";
import { listWorkflows } from "@/lib/workflows";
import { toSkillDTO } from "@/lib/map-data";
import { WorkflowsPanel } from "@/components/WorkflowsPanel";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { isOwner } = await getSessionFlags();
  const workflows = await listWorkflows();
  const skillRows = await prisma.skill.findMany({
    include: { knowledge: true },
    orderBy: { slug: "asc" },
  });
  const skills = skillRows.map(toSkillDTO);

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Workflows</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Multi-step skill chains with review gates and dry-run execution.
        </p>
      </div>
      <div className="overflow-auto p-[22px]">
        <WorkflowsPanel
          workflows={workflows}
          skills={skills}
          isOwner={isOwner}
        />
      </div>
    </main>
  );
}
