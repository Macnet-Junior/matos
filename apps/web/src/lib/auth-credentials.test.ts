import { describe, expect, it } from "vitest";
import { authorizeMatosPassword } from "./auth-credentials";

describe("production credentials", () => {
  it("keeps the local Desk password outside production", () => {
    expect(authorizeMatosPassword("dev", { NODE_ENV: "development" })).toBe(true);
    expect(authorizeMatosPassword("nope", { NODE_ENV: "test" })).toBe(false);
    expect(
      authorizeMatosPassword("local-secret", {
        NODE_ENV: "development",
        MATOS_AUTH_PASSWORD: "local-secret",
      }),
    ).toBe(true);
  });

  it("rejects the dev password and placeholders in production", () => {
    expect(
      authorizeMatosPassword("dev", {
        NODE_ENV: "production",
        AUTH_SECRET: "a-real-auth-secret-value",
        MATOS_AUTH_PASSWORD: "a-real-production-password",
      }),
    ).toBe(false);
    expect(
      authorizeMatosPassword("a-real-production-password", {
        NODE_ENV: "production",
        AUTH_SECRET: "replace-with-a-long-random-secret",
        MATOS_AUTH_PASSWORD: "a-real-production-password",
      }),
    ).toBe(false);
    expect(
      authorizeMatosPassword("a-real-production-password", {
        NODE_ENV: "production",
        AUTH_SECRET: "a-real-auth-secret-value",
        MATOS_AUTH_PASSWORD: "a-real-production-password",
      }),
    ).toBe(true);
  });
});
