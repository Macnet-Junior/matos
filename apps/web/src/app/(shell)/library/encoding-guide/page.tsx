export default function Page() {
  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">
          Encoding guide
        </h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          House style for skill authorship (Phase 2 stub).
        </p>
      </div>
      <div className="max-w-2xl space-y-4 p-[22px] text-xs leading-relaxed text-matos-muted">
        <section className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-sm font-semibold text-matos-text">Checklist</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4">
            <li>Purpose — one sentence on what the skill pays for.</li>
            <li>Instructions — operator-ready, no AI fluff.</li>
            <li>Steps — ordered, verifiable, ≤ 8 when possible.</li>
            <li>Knowledge — link real markdown under knowledge/.</li>
            <li>Review gate — Cold / Warm / Hot before external effects.</li>
            <li>Status — Authored only when instructions + knowledge exist.</li>
          </ol>
        </section>
        <p>
          Full validation UI and evidence attachments land as Phase 2 hardens.
        </p>
      </div>
    </main>
  );
}
