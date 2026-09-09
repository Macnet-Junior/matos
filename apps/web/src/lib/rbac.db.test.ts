import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import { resolveRole } from "./rbac";

describe("resolveRole (DB)", () => {
  beforeAll(async () => {
    const count = await prisma.userRole.count();
    if (count === 0) {
      throw new Error("UserRole not seeded — run pnpm db:seed");
    }
  });

  it("maps OWNER_EMAIL / macnet to Owner", async () => {
    process.env.OWNER_EMAIL = "macnet@matos.local";
    expect(await resolveRole("macnet@matos.local")).toBe("Owner");
    expect(await resolveRole("Macnet@Matos.Local")).toBe("Owner");
  });

  it("reads Operator / Author / Viewer from UserRole", async () => {
    expect(await resolveRole("operator@matos.local")).toBe("Operator");
    expect(await resolveRole("author@matos.local")).toBe("Author");
    expect(await resolveRole("viewer@matos.local")).toBe("Viewer");
  });

  it("defaults unknown emails to Viewer", async () => {
    expect(await resolveRole("stranger@example.com")).toBe("Viewer");
    expect(await resolveRole(null)).toBe("Viewer");
  });

  it("OWNER_EMAIL overrides a conflicting DB row", async () => {
    process.env.OWNER_EMAIL = "operator@matos.local";
    expect(await resolveRole("operator@matos.local")).toBe("Owner");
    process.env.OWNER_EMAIL = "macnet@matos.local";
  });
});
