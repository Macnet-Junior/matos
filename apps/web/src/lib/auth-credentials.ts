import { timingSafeEqual } from "node:crypto";

const PLACEHOLDER_SECRETS = new Set([
  "",
  "dev",
  "changeme",
  "replace-with-a-long-random-secret",
]);

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production";
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Local Desk login still accepts password `dev` outside production.
 * Production requires MATOS_AUTH_PASSWORD plus a real AUTH_SECRET, and rejects `dev`.
 */
export function authorizeMatosPassword(
  password: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!password) return false;
  if (!isProductionEnv(env)) {
    if (password === "dev") return true;
    const configured = env.MATOS_AUTH_PASSWORD ?? "";
    return Boolean(configured) && safeEqual(password, configured);
  }
  const configured = env.MATOS_AUTH_PASSWORD ?? "";
  const authSecret = env.AUTH_SECRET ?? "";
  if (PLACEHOLDER_SECRETS.has(configured) || PLACEHOLDER_SECRETS.has(authSecret)) {
    return false;
  }
  if (password === "dev") return false;
  return safeEqual(password, configured);
}
