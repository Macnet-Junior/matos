import { describe, expect, it } from "vitest";
import { evaluateProductionConfig, migrationStatusApplied } from "./production-readiness";
import { stripeBillingGate, STRIPE_BILLING_ENABLED } from "./ops/billing";
import { providerConfigHealth, redactSensitive } from "./content-observability";

describe("production scaffolds", () => {
  it("blocks production boot on placeholder auth, the dev database, and Stripe keys", () => {
    const result = evaluateProductionConfig({
      NODE_ENV: "production",
      AUTH_SECRET: "replace-with-a-long-random-secret",
      DATABASE_URL: "file:./dev.db",
      STRIPE_SECRET_KEY: "sk_live_example",
    });
    expect(result.ok).toBe(false);
    expect(result.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual(
      expect.arrayContaining(["auth-secret", "auth-password", "database", "stripe"]),
    );
    expect(JSON.stringify(result)).not.toContain("sk_live_example");
  });

  it("accepts a hosted config without live Stripe", () => {
    const result = evaluateProductionConfig({
      NODE_ENV: "production",
      AUTH_SECRET: "a-real-auth-secret-value",
      MATOS_AUTH_PASSWORD: "a-real-production-password",
      DATABASE_URL: "file:/var/lib/matos/prod.db",
    });
    expect(result.ok).toBe(true);
  });

  it("reads migration status without treating pending SQL as applied", () => {
    expect(migrationStatusApplied("Database schema is up to date!")).toBe(true);
    expect(
      migrationStatusApplied(
        "Following migration have not yet been applied:\n20260924103000_content_engine_remainder",
      ),
    ).toBe(false);
  });

  it("keeps Stripe disabled and redacts provider health output", () => {
    expect(STRIPE_BILLING_ENABLED).toBe(false);
    expect(stripeBillingGate().enabled).toBe(false);
    const health = providerConfigHealth({
      NODE_ENV: "test",
      LATE_API_KEY: "secret-late-key",
      WHATSAPP_TOKEN: "",
    });
    expect(health.find((item) => item.provider === "late-dev")?.configured).toBe(true);
    expect(JSON.stringify(health)).not.toContain("secret-late-key");
    expect(redactSensitive("Authorization: Bearer sk_live_abc")).not.toContain("sk_live_abc");
  });
});
