import { describe, expect, it } from "vitest";
import { assertIsolatedTestDatabase } from "./db-fixtures";

describe("isolated test database", () => {
  it("never points the suite at the development database", () => {
    expect(() => assertIsolatedTestDatabase()).not.toThrow();
    const url = (process.env.DATABASE_URL ?? "").replace(/\\/g, "/");
    expect(url).toContain("/.test/suite.db");
    expect(url).not.toContain("dev.db");
  });
});
