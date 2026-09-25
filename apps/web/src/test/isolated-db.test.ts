import { assertIsolatedDatabaseUrl } from "@matos/db";
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

/**
 * The guard above only ever runs against one URL — the one that is already
 * correct. These prove it actually refuses the ones that matter, so a future
 * change that stops enforcing isolation fails here instead of silently
 * pointing the suite at a real database.
 */
describe("assertIsolatedDatabaseUrl", () => {
  it("rejects the development database", () => {
    expect(() =>
      assertIsolatedDatabaseUrl("file:/home/dev/packages/db/prisma/dev.db"),
    ).toThrow(/Refusing to open/);
  });

  it("rejects an unset DATABASE_URL", () => {
    expect(() => assertIsolatedDatabaseUrl(undefined)).toThrow(/Refusing to open/);
  });

  it("rejects a relative dev.db even inside a .test directory", () => {
    expect(() => assertIsolatedDatabaseUrl("file:./prisma/dev.db")).toThrow(
      /Refusing to open/,
    );
  });

  it("accepts the isolated suite database, including with backslashes", () => {
    expect(() =>
      assertIsolatedDatabaseUrl("file:/repo/packages/db/prisma/.test/suite.db"),
    ).not.toThrow();
    expect(() =>
      assertIsolatedDatabaseUrl("file:C:\\repo\\packages\\db\\prisma\\.test\\suite.db"),
    ).not.toThrow();
  });
});
