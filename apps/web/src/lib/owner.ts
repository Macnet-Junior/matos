import { auth } from "@/auth";

export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? "macnet@matos.local").trim().toLowerCase();
}

export async function requireOwner() {
  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  }
  const email = session.user.email.trim().toLowerCase();
  if (email !== ownerEmail()) {
    return { ok: false as const, status: 403 as const, error: "Owner only" };
  }
  return {
    ok: true as const,
    email,
    name: session.user.name ?? email,
  };
}

export async function getSessionFlags() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? null;
  return {
    email,
    isOwner: !!email && email === ownerEmail(),
    name: session?.user?.name ?? null,
  };
}
