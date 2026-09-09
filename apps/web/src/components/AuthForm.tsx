"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@matos/ui";

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/map";
  const [email, setEmail] = useState("macnet@matos.local");
  const [password, setPassword] = useState("dev");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(nextEmail: string, nextPassword: string) {
    setPending(true);
    setError(null);
    const res = await signIn("credentials", {
      email: nextEmail,
      password: nextPassword,
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError("Invalid credentials. Use any email + password “dev”.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(email, password);
      }}
    >
      <label className="grid gap-1.5 text-xs text-matos-muted">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-matos-border bg-matos-panel px-3 py-2 text-sm text-matos-text outline-none focus:border-matos-citron"
          autoComplete="username"
          required
        />
      </label>
      <label className="grid gap-1.5 text-xs text-matos-muted">
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-matos-border bg-matos-panel px-3 py-2 text-sm text-matos-text outline-none focus:border-matos-citron"
          autoComplete="current-password"
          required
        />
      </label>
      {error && (
        <p className="text-xs text-matos-danger" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        variant="primary"
        className="w-full py-2.5"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="w-full py-2.5"
        disabled={pending}
        onClick={() => void submit("macnet@matos.local", "dev")}
      >
        Continue as Macnet Junior
      </Button>
    </form>
  );
}
