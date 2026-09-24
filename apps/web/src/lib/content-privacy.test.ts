import { describe, expect, it } from "vitest";
import { retentionCutoff, sanitizeExportValue, PRIVACY_RETENTION_DAYS } from "./content-privacy";

describe("privacy scaffolds", () => {
  it("drops secret-like fields from exports", () => {
    const exported = sanitizeExportValue({
      title: "Desk",
      accessToken: "sk_live_should_not_export",
      note: "Bearer sk_live_abc",
    }) as { title: string; accessToken?: string; note: string };
    expect(exported.title).toBe("Desk");
    expect(exported.accessToken).toBeUndefined();
    expect(exported.note).not.toContain("sk_live_abc");
  });

  it("computes retention cutoffs from the published policy", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const cutoff = retentionCutoff("metrics", now);
    expect(now.getTime() - cutoff.getTime()).toBe(PRIVACY_RETENTION_DAYS.metrics * 86_400_000);
  });
});
