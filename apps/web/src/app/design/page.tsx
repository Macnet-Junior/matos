import { Badge, Button, Panel } from "@matos/ui";

const swatches = [
  { name: "bg", hex: "#0b0c0e", className: "bg-matos-bg" },
  { name: "elev", hex: "#12141a", className: "bg-matos-elev" },
  { name: "panel", hex: "#161922", className: "bg-matos-panel" },
  { name: "border", hex: "#2a2e3a", className: "bg-matos-border" },
  { name: "muted", hex: "#8b93a7", className: "bg-matos-muted" },
  { name: "citron", hex: "#D6F31F", className: "bg-matos-citron" },
  { name: "hover", hex: "#E8FF5A", className: "bg-matos-citron-hover" },
  { name: "pressed", hex: "#B8D110", className: "bg-matos-citron-pressed" },
];

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-6 py-10">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Design tokens</h1>
        <p className="mt-2 text-sm text-matos-muted">
          Citron Volt system — precision dark UI for MatOS Phase 0.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-medium text-matos-muted">Colors</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map((s) => (
            <div
              key={s.name}
              className="overflow-hidden rounded-xl border border-matos-border"
            >
              <div className={`h-16 ${s.className}`} />
              <div className="bg-matos-elev px-3 py-2">
                <div className="text-xs font-medium">{s.name}</div>
                <div className="font-mono text-[11px] text-matos-muted">
                  {s.hex}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-matos-muted">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-matos-muted">Badges</h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Authored</Badge>
          <Badge tone="muted">Planned</Badge>
          <Badge tone="danger">Blocked</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-matos-muted">Panel</h2>
        <Panel className="p-4">
          <h3 className="text-sm font-semibold">Content Calendar</h3>
          <p className="mt-1 text-xs text-matos-muted">
            Sample panel surface using elevated border and soft shadow.
          </p>
        </Panel>
      </section>
    </main>
  );
}
