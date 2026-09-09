import { describe, expect, it } from "vitest";
import {
  hasPermission,
  capabilitiesFor,
  permissionsFor,
  type Permission,
} from "../rbac";

describe("Phase 5 ops/support RBAC", () => {
  it("Owner has ops:view + ops:manage + support", () => {
    const expected: Permission[] = [
      "ops:view",
      "ops:manage",
      "support:use",
      "support:ops",
    ];
    for (const p of expected) {
      expect(hasPermission("Owner", p)).toBe(true);
    }
    const caps = capabilitiesFor("Owner");
    expect(caps.canViewOps).toBe(true);
    expect(caps.canManageOps).toBe(true);
    expect(caps.canUseSupport).toBe(true);
    expect(caps.canOpsSupport).toBe(true);
  });

  it("Operator sees ops meters but cannot manage credits", () => {
    expect(hasPermission("Operator", "ops:view")).toBe(true);
    expect(hasPermission("Operator", "ops:manage")).toBe(false);
    expect(hasPermission("Operator", "support:ops")).toBe(true);
    expect(capabilitiesFor("Operator").canManageOps).toBe(false);
  });

  it("Author and Viewer can use support but not ops", () => {
    expect(hasPermission("Author", "support:use")).toBe(true);
    expect(hasPermission("Author", "ops:view")).toBe(false);
    expect(hasPermission("Viewer", "support:use")).toBe(true);
    expect(hasPermission("Viewer", "ops:view")).toBe(false);
    expect(hasPermission("Viewer", "support:ops")).toBe(false);
    expect(capabilitiesFor("Viewer").canViewOps).toBe(false);
    expect(capabilitiesFor("Viewer").canUseSupport).toBe(true);
  });

  it("Owner matrix still includes prior Phase 4 perms", () => {
    expect(permissionsFor("Owner")).toContain("map:manage");
    expect(permissionsFor("Owner")).toContain("activity:export");
  });
});
