import { notFound } from "next/navigation";
import { getSessionFlags } from "@/lib/owner";
import { getDeskJob } from "@/lib/desk";
import { DeskJobDetail } from "@/components/desk/DeskJobDetail";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getDeskJob(id);
  if (!job) notFound();
  const flags = await getSessionFlags();

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-matos-bg">
      <DeskJobDetail
        job={job}
        canRun={flags.canRunDesk}
        canApprove={flags.canApproveDesk}
      />
    </main>
  );
}
