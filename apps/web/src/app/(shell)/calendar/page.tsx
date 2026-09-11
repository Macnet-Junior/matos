import { listCalendarItems } from "@/lib/desk";
import { DeskCalendar } from "@/components/desk/DeskCalendar";

export const dynamic = "force-dynamic";

export default async function Page() {
  const items = await listCalendarItems();
  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Calendar</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Desk schedule board for Press packs. Publishing stays offline.
        </p>
      </div>
      <DeskCalendar items={items} />
    </main>
  );
}
