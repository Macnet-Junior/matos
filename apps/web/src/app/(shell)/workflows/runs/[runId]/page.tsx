import { notFound } from "next/navigation";
import { getSessionFlags } from "@/lib/owner";
import { getRun } from "@/lib/workflows";
import { RunTrace } from "@/components/RunTrace";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ runId: string }> };

export default async function Page({ params }: Props) {
  const { runId } = await params;
  const { isOwner } = await getSessionFlags();
  const run = await getRun(runId);
  if (!run) notFound();

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Run trace</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Step logs and JSON artifacts from a dry-run. Publish is simulated
          only after approval.
        </p>
      </div>
      <div className="overflow-auto p-[22px]">
        <RunTrace run={run} isOwner={isOwner} />
      </div>
    </main>
  );
}
