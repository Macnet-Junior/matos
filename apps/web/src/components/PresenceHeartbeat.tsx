"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const INTERVAL_MS = 30_000;

export function PresenceHeartbeat() {
  const pathname = usePathname();
  const { status } = useSession();
  const loggedLogin = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    async function beat(login: boolean) {
      try {
        await fetch("/api/ops/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPath: pathname, login }),
        });
      } catch {
        /* ignore heartbeat failures */
      }
    }

    const isLogin = !loggedLogin.current;
    if (isLogin) loggedLogin.current = true;
    void beat(isLogin);

    const id = window.setInterval(() => {
      if (!cancelled) void beat(false);
    }, INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [status, pathname]);

  return null;
}
