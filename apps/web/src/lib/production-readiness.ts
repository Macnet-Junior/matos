import { PLACEHOLDER_AUTH_VALUES } from "./production-readiness-constants";

export { PLACEHOLDER_AUTH_VALUES };

export type ReadinessCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

export function evaluateProductionConfig(env: NodeJS.ProcessEnv = process.env): {
  ok: boolean;
  checks: ReadinessCheck[];
} {
  const production = env.NODE_ENV === "production";
  const checks: ReadinessCheck[] = [];
  const authSecret = env.AUTH_SECRET ?? "";
  const password = env.MATOS_AUTH_PASSWORD ?? "";
  const databaseUrl = env.DATABASE_URL ?? "";
  checks.push({
    id: "auth-secret",
    ok: !production || (!PLACEHOLDER_AUTH_VALUES.has(authSecret) && authSecret.length >= 16),
    detail: "AUTH_SECRET must be a non-placeholder server secret in production",
  });
  checks.push({
    id: "auth-password",
    ok: !production || (!PLACEHOLDER_AUTH_VALUES.has(password) && password !== "dev"),
    detail: "MATOS_AUTH_PASSWORD replaces the local dev password in production",
  });
  checks.push({
    id: "database",
    ok: !production || (!databaseUrl.includes("dev.db") && databaseUrl.length > 0),
    detail: "Production DATABASE_URL must not point at the development database",
  });
  checks.push({
    id: "stripe",
    ok: !env.STRIPE_SECRET_KEY && !env.STRIPE_WEBHOOK_SECRET,
    detail: "Live Stripe stays disabled until credit reconciliation is production-ready",
  });
  return { ok: checks.every((check) => check.ok), checks };
}

export function migrationStatusApplied(output: string): boolean {
  const text = output.toLowerCase();
  if (text.includes("following migration") && text.includes("have not yet been applied")) {
    return false;
  }
  if (text.includes("error")) return false;
  return text.includes("database schema is up to date") || text.includes("no pending migrations");
}
