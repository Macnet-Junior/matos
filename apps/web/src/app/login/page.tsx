import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(214,243,31,0.06),transparent_55%),#0b0c0e] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-matos-border bg-matos-elev p-6 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-matos-citron text-sm font-extrabold text-[#0b0c0e]">
            M
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">MatOS</h1>
            <p className="text-xs text-matos-muted2">Dev sign-in · Phase 0</p>
          </div>
        </div>
        <AuthForm />
        <p className="mt-4 text-[11px] leading-relaxed text-matos-muted2">
          Credentials provider for local development only. Password is{" "}
          <code className="text-matos-muted">dev</code>. Not for production.
        </p>
      </div>
    </main>
  );
}
