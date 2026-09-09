export default function Page() {
  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Repository</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">Linked knowledge tree for canon docs and skill sources.</p>
      </div>
      <div className="p-[22px]">
        <div className="rounded-xl border border-matos-border bg-matos-panel p-4 text-xs text-matos-muted">
          Phase 0 shell surface — content lands in a later phase. Use{" "}
          <span className="text-matos-text">Company map</span> for the live
          canvas.
        </div>
      </div>
    </main>
  );
}
