import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import { assertIsolatedTestDatabase } from "@/test/db-fixtures";
import {
  createPerformanceInsight,
  linkReviewedInsight,
  reviewPerformanceInsight,
} from "./content-insights";

describe("reviewed performance insights", () => {
  const created: string[] = [];

  afterAll(async () => {
    if (created.length) {
      await prisma.contentInsight.deleteMany({ where: { id: { in: created } } });
    }
  });

  it("links a reviewed insight to a skill and knowledge file", async () => {
    assertIsolatedTestDatabase();
    const insight = await createPerformanceInsight({
      summary: "Warm review outperformed ungated posts on clicks.",
      actorEmail: "operator@matos.local",
    });
    created.push(insight.id);
    await expect(
      linkReviewedInsight({
        insightId: insight.id,
        skillSlug: "hook-lab",
        knowledgePath: "knowledge/brand/voice.md",
        actorEmail: "operator@matos.local",
      }),
    ).rejects.toThrow(/reviewed/);

    await reviewPerformanceInsight({
      insightId: insight.id,
      actorEmail: "operator@matos.local",
    });
    const linked = await linkReviewedInsight({
      insightId: insight.id,
      skillSlug: "hook-lab",
      knowledgePath: "knowledge/brand/voice.md",
      actorEmail: "operator@matos.local",
    });
    expect(linked.status).toBe("reviewed");
    expect(linked.skillSlug).toBe("hook-lab");
    expect(linked.knowledgePath).toBe("knowledge/brand/voice.md");
  });
});
