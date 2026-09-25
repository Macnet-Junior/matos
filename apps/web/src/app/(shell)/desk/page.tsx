import { getSessionFlags } from "@/lib/owner";
import { deskOwner, listDeskJobs } from "@/lib/desk";
import { DeskBoard } from "@/components/desk/DeskBoard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await getSessionFlags();
  const jobs = await listDeskJobs(deskOwner(flags.email));

  return (
    <main className="flex flex-1 flex-col overflow-auto bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Desk</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Relay Desk — content newsroom mode. Human gates on every stage.
        </p>
      </div>
      <DeskBoard jobs={jobs} canRun={flags.canRunDesk} />
    </main>
  );
}
