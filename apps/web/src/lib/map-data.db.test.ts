import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import { loadMapPayload } from "./map-data";

describe("SQLite map payload", () => {
  beforeAll(async () => {
    const count = await prisma.department.count();
    if (count === 0) {
      throw new Error("Database not seeded — run pnpm db:seed");
    }
  });

  it("loads seven departments and commercial seed skills", async () => {
    const map = await loadMapPayload(null);
    expect(map.company.name).toBe("MatOS Agency");
    expect(map.departments).toHaveLength(7);
    const slugs = map.departments.flatMap((d) => d.skills.map((s) => s.slug));
    expect(slugs).toEqual(
      expect.arrayContaining([
        "content-calendar",
        "etsy-listing-lab",
        "hook-lab",
        "short-script",
      ]),
    );
    expect(map.stats.authored).toBeGreaterThanOrEqual(4);
  });

  it("attaches knowledge links on authored skills", async () => {
    const map = await loadMapPayload(null);
    const calendar = map.departments
      .flatMap((d) => d.skills)
      .find((s) => s.slug === "content-calendar");
    expect(calendar?.status).toBe("authored");
    expect(calendar?.knowledge.map((k) => k.path)).toEqual(
      expect.arrayContaining([
        "knowledge/brand/voice.md",
        "knowledge/content/mix-ratios.md",
      ]),
    );
  });
});
