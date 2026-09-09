import { prisma } from "@matos/db";

export type Role = "Owner" | "Operator" | "Author" | "Viewer";

export type Permission =
  | "map:manage"
  | "skill:edit"
  | "workflow:manage"
  | "workflow:run"
  | "workflow:approve"
  | "activity:export";

export const ROLES: Role[] = ["Owner", "Operator", "Author", "Viewer"];

/** Role → permissions matrix (Phase 4 hardening). */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  Owner: [
    "map:manage",
    "skill:edit",
    "workflow:manage",
    "workflow:run",
    "workflow:approve",
    "activity:export",
  ],
  Operator: ["workflow:run", "workflow:approve"],
  Author: ["skill:edit"],
  Viewer: [],
};

export function ownerEmail(): string {
  return (process.env.OWNER_EMAIL ?? "macnet@matos.local").trim().toLowerCase();
}

export function isRole(value: string): value is Role {
  return (ROLES as string[]).includes(value);
}

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export type Capabilities = {
  canManageMap: boolean;
  canEditSkills: boolean;
  canManageWorkflows: boolean;
  canRunWorkflows: boolean;
  canApprove: boolean;
  canExportActivity: boolean;
};

export function capabilitiesFor(role: Role): Capabilities {
  return {
    canManageMap: hasPermission(role, "map:manage"),
    canEditSkills: hasPermission(role, "skill:edit"),
    canManageWorkflows: hasPermission(role, "workflow:manage"),
    canRunWorkflows: hasPermission(role, "workflow:run"),
    canApprove: hasPermission(role, "workflow:approve"),
    canExportActivity: hasPermission(role, "activity:export"),
  };
}

/**
 * Resolve role for an email.
 * OWNER_EMAIL always maps to Owner (env wins over DB row).
 * Otherwise look up UserRole; default Viewer.
 */
export async function resolveRole(email: string | null | undefined): Promise<Role> {
  if (!email) return "Viewer";
  const normalized = email.trim().toLowerCase();
  if (!normalized) return "Viewer";
  if (normalized === ownerEmail()) return "Owner";

  const row = await prisma.userRole.findUnique({
    where: { email: normalized },
  });
  if (row && isRole(row.role)) return row.role;
  return "Viewer";
}

export function assertPermission(role: Role, permission: Permission): boolean {
  return hasPermission(role, permission);
}
