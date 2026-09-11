import Link from "next/link";

export default function Page() {
  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Library</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Reusable frameworks, house-style guides, and filed Desk jobs.
        </p>
      </div>
      <div className="grid gap-3 p-[22px] sm:grid-cols-2">
        <Link
          href="/library/encoding-guide"
          className="rounded-xl border border-matos-border bg-matos-panel p-4 transition-colors hover:border-matos-citron"
        >
          <h2 className="text-sm font-semibold tracking-tight">Encoding guide</h2>
          <p className="mt-2 text-xs text-matos-muted">
            How MatOS authors skills — purpose, steps, review gate, knowledge.
          </p>
        </Link>
        <Link
          href="/library/desk"
          className="rounded-xl border border-matos-border bg-matos-panel p-4 transition-colors hover:border-matos-citron"
        >
          <h2 className="text-sm font-semibold tracking-tight">Desk archive</h2>
          <p className="mt-2 text-xs text-matos-muted">
            Finished Relay Desk jobs filed after Echo approval.
          </p>
        </Link>
      </div>
    </main>
  );
}
