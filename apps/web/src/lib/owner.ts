import { auth } from "@/auth";
import {
  capabilitiesFor,
  hasPermission,
  resolveRole,
  type Permission,
  type Role,
  type Capabilities,
} from "@/lib/rbac";
import { rateLimit } from "@/lib/rate-limit";

export { ownerEmail } from "@/lib/rbac";
export type { Role, Capabilities, Permission };

export async function getSessionFlags() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase() ?? null;
  const role: Role = await resolveRole(email);
  const caps = capabilitiesFor(role);
  return {
    email,
    role,
    isOwner: role === "Owner",
    name: session?.user?.name ?? null,
    ...caps,
  };
}

type GateOk = {
  ok: true;
  email: string;
  name: string;
  role: Role;
} & Capabilities;

type GateFail = {
  ok: false;
  status: 401 | 403 | 429;
  error: string;
};

async function requirePermission(
  permission: Permission,
  opts?: { rateKey?: string; rateLimit?: number },
): Promise<GateOk | GateFail> {
  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const email = session.user.email.trim().toLowerCase();
  const role = await resolveRole(email);

  if (opts?.rateKey) {
    const rl = rateLimit(
      `${opts.rateKey}:${email}`,
      opts.rateLimit ?? 30,
      60_000,
    );
    if (!rl.ok) {
      return {
        ok: false,
        status: 429,
        error: `Rate limit exceeded — retry in ${Math.ceil(rl.retryAfterMs / 1000)}s`,
      };
    }
  }

  if (!hasPermission(role, permission)) {
    return {
      ok: false,
      status: 403,
      error: `Forbidden — requires ${permission} (${role})`,
    };
  }

  return {
    ok: true,
    email,
    name: session.user.name ?? email,
    role,
    ...capabilitiesFor(role),
  };
}

/** @deprecated Prefer requirePermission("map:manage") — kept for Owner-only ops. */
export async function requireOwner() {
  return requirePermission("map:manage", {
    rateKey: "owner-mutation",
    rateLimit: 60,
  });
}

export async function requireMapManage() {
  return requirePermission("map:manage", {
    rateKey: "map-manage",
    rateLimit: 60,
  });
}

export async function requireSkillEdit() {
  return requirePermission("skill:edit", {
    rateKey: "skill-edit",
    rateLimit: 60,
  });
}

export async function requireWorkflowManage() {
  return requirePermission("workflow:manage", {
    rateKey: "workflow-manage",
    rateLimit: 40,
  });
}

export async function requireWorkflowRun() {
  return requirePermission("workflow:run", {
    rateKey: "workflow-run",
    rateLimit: 20,
  });
}

export async function requireWorkflowApprove() {
  return requirePermission("workflow:approve", {
    rateKey: "workflow-approve",
    rateLimit: 40,
  });
}

export async function requireActivityExport() {
  return requirePermission("activity:export", {
    rateKey: "activity-export",
    rateLimit: 10,
  });
}

export async function requireOpsView() {
  return requirePermission("ops:view", {
    rateKey: "ops-view",
    rateLimit: 120,
  });
}

export async function requireOpsManage() {
  return requirePermission("ops:manage", {
    rateKey: "ops-manage",
    rateLimit: 40,
  });
}

export async function requireSupportUse() {
  return requirePermission("support:use", {
    rateKey: "support-use",
    rateLimit: 60,
  });
}

export async function requireSupportOps() {
  return requirePermission("support:ops", {
    rateKey: "support-ops",
    rateLimit: 60,
  });
}

/** Any authenticated session (for presence heartbeat). */
export async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  }
  const email = session.user.email.trim().toLowerCase();
  const role = await resolveRole(email);
  return {
    ok: true as const,
    email,
    name: session.user.name ?? email,
    role,
    ...capabilitiesFor(role),
  };
}

export async function requireDeskRun() {
  return requirePermission("desk:run", {
    rateKey: "desk-run",
    rateLimit: 40,
  });
}

export async function requireDeskApprove() {
  return requirePermission("desk:approve", {
    rateKey: "desk-approve",
    rateLimit: 40,
  });
}
