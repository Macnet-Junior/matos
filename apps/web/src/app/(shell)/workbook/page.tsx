import Link from "next/link";

export default function Page() {
  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Workbook</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">Active projects and campaigns as structured runs.</p>
      </div>
      <div className="p-[22px]">
        <div className="rounded-xl border border-matos-border bg-matos-panel p-4 text-xs text-matos-muted">
          Phase 0 shell surface — content lands in a later phase. Use{" "}
          <Link href="/map" className="text-matos-citron">
            Company map
          </Link>{" "}
          for the live canvas.
        </div>
      </div>
    </main>
  );
}
