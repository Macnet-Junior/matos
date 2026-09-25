import { countDeskRuns, monthWindowInclusive } from "@/lib/ops/usage";
import { ownerEmail } from "@/lib/rbac";

/**
 * What each tier grants, in the one unit a user can reason about.
 *
 * The pricing rule MatOS runs on is that the price is derived from what a tier
 * grants, not the other way round. So this file defines the grants and nothing
 * else — no prices. A price lives where prices already live (the offer rungs
 * in the brain), and it can only be written once the cost of a run is known
 * from measured usage. Putting a number here would invert the rule and make
 * the allowance a thing we negotiate down from a price we already promised.
 *
 * The unit is **desk runs per month**: one stage advanced by a human. Six
 * runs is one brief taken Scout → Echo. It is countable, visible in the desk
 * UI, and — critically — it does not change meaning when the model behind it
 * changes. A token allowance would let us ship the same tier at half the
 * quality without the user noticing; a run allowance cannot.
 *
 * HOSTED grants inference. BYOK does not: the user's own key pays for tokens
 * and ours is never touched, so the BYOK tier is priced for software alone and
 * carries a *different* cap for a different reason. The BYOK cap is not about
 * our token cost — it is about our CPU, queue and publishing quota, which an
 * unlimited external key still consumes. Capping BYOK in tokens would be
 * meaningless; capping it in runs is the only honest option, which is why the
 * same unit spans both.
 */
export const TIER_IDS = ["free", "operator", "studio"] as const;
export type TierId = (typeof TIER_IDS)[number];

/** How inference is paid for on a given plan. */
export type InferenceMode = "hosted" | "byok";

export type TierGrant = {
  id: TierId;
  /** The tier as the user sees it. */
  label: string;
  /** Desk runs per calendar month. Hard: not a soft warning. */
  monthlyRuns: number;
  /**
   * Paid tiers bill per run past the allowance, at the cost of a run, instead
   * of the run being refused. Free does not — a free tier that can silently
   * add spend against no payment method is not free, it is an invoice.
   */
  overageAllowed: boolean;
  /** Publishing is simulated until the brain has been reviewed once. */
  livePublish: boolean;
};

export const TIER_GRANTS: Record<TierId, TierGrant> = {
  free: {
    id: "free",
    label: "Free",
    monthlyRuns: 30,
    overageAllowed: false,
    livePublish: false,
  },
  operator: {
    id: "operator",
    label: "Operator",
    monthlyRuns: 300,
    overageAllowed: true,
    livePublish: true,
  },
  studio: {
    id: "studio",
    label: "Studio",
    monthlyRuns: 1500,
    overageAllowed: true,
    livePublish: true,
  },
};

/**
 * The owner is not a customer.
 *
 * A cap that applies to the person building the product is a cap that gets
 * removed the first afternoon it blocks a test, and then the free tier's real
 * behaviour is never exercised. So the owner is explicitly unlimited and the
 * *customer* paths are the ones the suite exercises — the cap is tested by
 * pretending to be a customer, never by loosening it.
 *
 * The owner check reads OWNER_EMAIL, not the role table: the role is what the
 * app shows, this is who the deployment belongs to.
 */
function isDeploymentOwner(email: string | null): boolean {
  return !!email && email === ownerEmail();
}

export type TierStatus = {
  tier: TierId;
  label: string;
  inference: InferenceMode;
  /** Runs already consumed in the current month window. */
  used: number;
  /** Runs granted in the window; null means no cap. */
  limit: number | null;
  remaining: number | null;
  /** True when the next run must be refused (cap reached, no overage). */
  exhausted: boolean;
  /** True when the next run is billable past the allowance. */
  overage: boolean;
  livePublish: boolean;
  /** First instant of the current window — the day the count resets. */
  windowStart: string;
};

export function resolveTier(email: string | null | undefined): TierId {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (!normalized) return "free";
  if (isDeploymentOwner(normalized)) return "studio";
  // Tier assignment for real accounts is not built yet — every non-owner is
  // on free until the billing hook exists. Guessing higher would hand out
  // paid inference to anyone who signs in.
  return "free";
}

export async function getTierStatus(input: {
  email: string | null | undefined;
  inference?: InferenceMode;
  now?: Date;
}): Promise<TierStatus> {
  const normalized = input.email?.trim().toLowerCase() ?? null;
  const tier = resolveTier(normalized);
  const grant = TIER_GRANTS[tier];
  const inference = input.inference ?? "hosted";
  const { start, end } = monthWindowInclusive(input.now);

  // The owner runs unmetered. We still count, so the desk can show real usage
  // and the cost side stays observable — we just never refuse.
  const unlimited = isDeploymentOwner(normalized);
  const used = normalized
    ? await countDeskRuns({ userId: normalized, since: start, until: end })
    : 0;

  const limit = unlimited ? null : grant.monthlyRuns;
  const remaining = limit === null ? null : Math.max(0, limit - used);

  return {
    tier,
    label: grant.label,
    inference,
    used,
    limit,
    remaining,
    exhausted: limit !== null && remaining === 0,
    overage: limit !== null && used >= limit && grant.overageAllowed,
    livePublish: grant.livePublish,
    windowStart: start.toISOString(),
  };
}

/**
 * The gate. Every desk run asks this before it spends anything.
 *
 * Deliberately a yes/no on a *reading*: the count is computed from the ledger
 * at call time rather than decremented from a stored balance, so a crash
 * mid-run cannot leave the counter short a run the user never got. The cost
 * is one indexed query per run, which is nothing beside a model call.
 *
 * Race note, stated plainly: two runs starting in the same millisecond can
 * both read `remaining: 1` and both proceed. That overshoots by one run, it
 * is bounded, and it costs cents — where a lock around every run would cost
 * latency on the hot path and a second source of truth. Tighten this only if
 * a real customer abuses it.
 */
export async function canRunDesk(input: {
  email: string | null | undefined;
  inference?: InferenceMode;
  now?: Date;
}): Promise<{ ok: true; status: TierStatus } | { ok: false; status: TierStatus; reason: string }> {
  const status = await getTierStatus(input);
  if (!status.exhausted) return { ok: true, status };

  return {
    ok: false,
    status,
    reason:
      `${status.label} includes ${status.limit} desk runs a month and this month's ` +
      `are used. The count resets on ` +
      `${new Date(status.windowStart).toISOString().slice(0, 10)} next month.`,
  };
}
