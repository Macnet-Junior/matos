import { describe, expect, it } from "vitest";
import {
  ROLE_PERMISSIONS,
  capabilitiesFor,
  hasPermission,
  isRole,
  permissionsFor,
  type Permission,
  type Role,
} from "./rbac";
import {
  __resetRateLimitForTests,
  rateLimit,
} from "./rate-limit";

describe("RBAC matrix", () => {
  it("defines four roles", () => {
    expect(isRole("Owner")).toBe(true);
    expect(isRole("Operator")).toBe(true);
    expect(isRole("Author")).toBe(true);
    expect(isRole("Viewer")).toBe(true);
    expect(isRole("Admin")).toBe(false);
  });

  it("Owner has full CRUD + run + approve + export + ops", () => {
    const perms = permissionsFor("Owner");
    const expected: Permission[] = [
      "map:manage",
      "skill:edit",
      "workflow:manage",
      "workflow:run",
      "workflow:approve",
      "activity:export",
      "ops:view",
      "ops:manage",
      "support:use",
      "support:ops",
    ];
    for (const p of expected) {
      expect(perms).toContain(p);
      expect(hasPermission("Owner", p)).toBe(true);
    }
    const caps = capabilitiesFor("Owner");
    expect(caps.canManageMap).toBe(true);
    expect(caps.canEditSkills).toBe(true);
    expect(caps.canManageWorkflows).toBe(true);
    expect(caps.canRunWorkflows).toBe(true);
    expect(caps.canApprove).toBe(true);
    expect(caps.canExportActivity).toBe(true);
    expect(caps.canViewOps).toBe(true);
    expect(caps.canManageOps).toBe(true);
  });

  it("Operator can run, approve, and view ops", () => {
    expect(hasPermission("Operator", "workflow:run")).toBe(true);
    expect(hasPermission("Operator", "workflow:approve")).toBe(true);
    expect(hasPermission("Operator", "ops:view")).toBe(true);
    expect(hasPermission("Operator", "skill:edit")).toBe(false);
    expect(hasPermission("Operator", "map:manage")).toBe(false);
    expect(hasPermission("Operator", "workflow:manage")).toBe(false);
    expect(hasPermission("Operator", "activity:export")).toBe(false);
    expect(hasPermission("Operator", "ops:manage")).toBe(false);
    const caps = capabilitiesFor("Operator");
    expect(caps.canRunWorkflows).toBe(true);
    expect(caps.canApprove).toBe(true);
    expect(caps.canViewOps).toBe(true);
    expect(caps.canEditSkills).toBe(false);
  });

  it("Author can edit skills + use support", () => {
    expect(hasPermission("Author", "skill:edit")).toBe(true);
    expect(hasPermission("Author", "support:use")).toBe(true);
    expect(hasPermission("Author", "workflow:run")).toBe(false);
    expect(hasPermission("Author", "map:manage")).toBe(false);
    expect(hasPermission("Author", "ops:view")).toBe(false);
    expect(capabilitiesFor("Author").canEditSkills).toBe(true);
    expect(capabilitiesFor("Author").canManageMap).toBe(false);
  });

  it("Viewer is read-only except support", () => {
    expect(ROLE_PERMISSIONS.Viewer).toEqual(["support:use"]);
    const caps = capabilitiesFor("Viewer");
    expect(caps.canUseSupport).toBe(true);
    expect(caps.canManageMap).toBe(false);
    expect(caps.canViewOps).toBe(false);
  });

  it("matrix covers every role key", () => {
    const roles: Role[] = ["Owner", "Operator", "Author", "Viewer"];
    for (const role of roles) {
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true);
    }
  });
});

describe("rate limit", () => {
  it("allows up to limit then blocks", () => {
    __resetRateLimitForTests();
    const key = "test:rbac";
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, 5, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});
