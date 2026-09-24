import { describe, expect, it } from "vitest";
import { parseMetricImport, validateMetricDraft } from "./content-metrics";

describe("content metrics", () => {
  it("accepts a bounded metric window", () => {
    expect(
      validateMetricDraft({
        publicationId: "pub-1",
        kind: "impressions",
        value: 12,
        windowStart: "2026-01-01T00:00:00.000Z",
        windowEnd: "2026-01-02T00:00:00.000Z",
      }),
    ).toMatchObject({ kind: "impressions", value: 12 });
  });

  it("rejects private audience fields and oversized imports", () => {
    expect(() =>
      validateMetricDraft({
        publicationId: "pub-1",
        kind: "clicks",
        value: 1,
        email: "person@example.com",
      }),
    ).toThrow("private_field_rejected");

    expect(() =>
      parseMetricImport("publicationId,email\npub-1,person@example.com", "csv"),
    ).toThrow("private_field_rejected");

    const rows = Array.from({ length: 501 }, () => ({
      publicationId: "pub-1",
      kind: "clicks",
      value: 1,
    }));
    expect(() => parseMetricImport(JSON.stringify(rows), "json")).toThrow(
      "import exceeds 500 rows",
    );
  });
});
