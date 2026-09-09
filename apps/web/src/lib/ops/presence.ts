import { prisma } from "@matos/db";
import type { Role } from "@/lib/rbac";

/** Consider online if heartbeat within this window */
export const ONLINE_WINDOW_MS = 90_000;

export async function upsertPresence(input: {
  email: string;
  role: Role | string;
  currentPath?: string | null;
}) {
  const email = input.email.trim().toLowerCase();
  const now = new Date();
  return prisma.userPresence.upsert({
    where: { email },
    create: {
      email,
      role: input.role,
      lastSeenAt: now,
      currentPath: input.currentPath ?? null,
    },
    update: {
      role: input.role,
      lastSeenAt: now,
      currentPath: input.currentPath ?? undefined,
    },
  });
}

export function isOnline(lastSeenAt: Date, now = Date.now()): boolean {
  return now - lastSeenAt.getTime() <= ONLINE_WINDOW_MS;
}

export async function listPresence() {
  const rows = await prisma.userPresence.findMany({
    orderBy: { lastSeenAt: "desc" },
  });
  const now = Date.now();
  const people = rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    lastSeenAt: r.lastSeenAt.toISOString(),
    currentPath: r.currentPath,
    online: isOnline(r.lastSeenAt, now),
  }));
  const onlineCount = people.filter((p) => p.online).length;
  return { people, onlineCount, windowMs: ONLINE_WINDOW_MS };
}
