import { getSessionFlags } from "@/lib/owner";
import { deskOwner, listInboxItems } from "@/lib/desk";
import { DeskInbox } from "@/components/desk/DeskInbox";

export const dynamic = "force-dynamic";

export default async function Page() {
  const flags = await getSessionFlags();
  const items = await listInboxItems(deskOwner(flags.email));
  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Echo reply drafts. Approve or copy — never auto-send.
        </p>
      </div>
      <DeskInbox items={items} canApprove={flags.canApproveDesk} />
    </main>
  );
}
