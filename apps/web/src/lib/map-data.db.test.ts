import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import { collectKnowledgeRefs, knowledgeFileExists } from "./knowledge";
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

  it("links etsy checklist and offers on etsy-listing-lab", async () => {
    const map = await loadMapPayload(null);
    const etsy = map.departments
      .flatMap((d) => d.skills)
      .find((s) => s.slug === "etsy-listing-lab");
    expect(etsy?.status).toBe("authored");
    expect(etsy?.knowledge.map((k) => k.path)).toEqual(
      expect.arrayContaining([
        "knowledge/content/etsy-listing-checklist.md",
        "knowledge/monetization/offers.md",
      ]),
    );
    expect(etsy?.evidence[0]?.label).toBeTruthy();
  });

  it("seeded skill knowledge and evidence files exist on disk", async () => {
    const map = await loadMapPayload(null);
    const skills = map.departments.flatMap((d) => d.skills);
    const missing: string[] = [];
    for (const skill of skills) {
      for (const rel of collectKnowledgeRefs(skill)) {
        if (!(await knowledgeFileExists(rel))) {
          missing.push(`${skill.slug}: ${rel}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("treats the former missing catalog as planned, not broken", async () => {
    const map = await loadMapPayload(null);
    const bySlug = Object.fromEntries(
      map.departments.flatMap((d) => d.skills).map((s) => [s.slug, s]),
    );
    for (const slug of [
      "trend-radar",
      "voice-miner",
      "offer-fit",
      "offer-ladder",
      "etsy-publish",
      "whatsapp-drop",
    ]) {
      expect(bySlug[slug]?.status, slug).toBe("planned");
    }
    expect(map.stats.authored).toBe(4);
    expect(map.stats.missing).toBe(0);
    expect(map.stats.skillCount).toBe(33);
  });
});
