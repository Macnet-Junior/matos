import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import { assertIsolatedTestDatabase } from "@/test/db-fixtures";
import { monthWindowInclusive } from "@/lib/ops/usage";
import { ownerEmail } from "@/lib/rbac";
import { canRunDesk, getTierStatus, resolveTier, TIER_GRANTS } from "./tiers";

/**
 * The allowance has to actually refuse, not warn.
 *
 * A cap that only shows a banner is the failure mode this file exists to
 * prevent: the user keeps running, our token bill keeps growing, and the
 * "hard cap" in the pricing page turns out to have been decorative. So the
 * assertions here are on the *refusal*, and on the run that follows it being
 * impossible rather than merely discouraged.
 *
 * See matos-brain/strategy/market.md — "the tier cap must be hard, not soft".
 */

const CUSTOMER = "tier-test-customer@matos.test";

async function clearCustomerRuns() {
  await prisma.usageEvent.deleteMany({ where: { userId: CUSTOMER } });
}

/** Put the customer exactly at (or over) their monthly allowance. */
async function consumeRuns(count: number) {
  const { start } = monthWindowInclusive();
  await prisma.usageEvent.createMany({
    data: Array.from({ length: count }, () => ({
      userId: CUSTOMER,
      kind: "ai_credit",
      units: 1,
      metaJson: "{}",
      createdAt: new Date(start.getTime() + 60_000),
    })),
  });
}

describe("tier allowance (db)", () => {
  beforeEach(async () => {
    assertIsolatedTestDatabase();
    await clearCustomerRuns();
  });

  afterEach(async () => {
    await clearCustomerRuns();
  });

  it("counts only runs inside the current month window", async () => {
    // Last month's runs must not eat this month's allowance — otherwise the
    // reset never happens and the cap is permanent after a heavy month.
    const { start } = monthWindowInclusive();
    const lastMonth = new Date(start.getTime() - 24 * 60 * 60 * 1000);

    await prisma.usageEvent.createMany({
      data: [
        {
          userId: CUSTOMER,
          kind: "ai_credit",
          units: 1,
          metaJson: "{}",
          createdAt: lastMonth,
        },
        {
          userId: CUSTOMER,
          kind: "ai_credit",
          units: 1,
          metaJson: "{}",
          createdAt: new Date(start.getTime() + 60_000),
        },
        {
          // A different kind of usage in this window: search, images and voice
          // are real costs but they are not desk runs, and must not consume
          // the run allowance.
          userId: CUSTOMER,
          kind: "api_hit",
          units: 99,
          metaJson: "{}",
          createdAt: new Date(start.getTime() + 60_000),
        },
      ],
    });

    const status = await getTierStatus({ email: CUSTOMER });
    expect(status.used).toBe(1);
  });

  it("counts units, not rows, so a batched run cannot slip past the cap", async () => {
    const { start } = monthWindowInclusive();
    // One row representing six runs — a pipeline billed in a single event.
    await prisma.usageEvent.create({
      data: {
        userId: CUSTOMER,
        kind: "ai_credit",
        units: 6,
        metaJson: "{}",
        createdAt: new Date(start.getTime() + 60_000),
      },
    });

    const status = await getTierStatus({ email: CUSTOMER });
    expect(status.used).toBe(6);
  });

  it("permits runs below the cap and refuses at it", async () => {
    const limit = TIER_GRANTS.free.monthlyRuns;

    await consumeRuns(limit - 1);
    const under = await canRunDesk({ email: CUSTOMER });
    expect(under.ok).toBe(true);
    expect(under.status.remaining).toBe(1);

    await consumeRuns(1);
    const at = await canRunDesk({ email: CUSTOMER });
    expect(at.ok).toBe(false);
    if (at.ok) throw new Error("unreachable");
    expect(at.status.exhausted).toBe(true);
    expect(at.status.remaining).toBe(0);
    expect(at.reason).toContain(String(limit));
  });

  it("treats the free tier as capped and the owner as unmetered", async () => {
    await consumeRuns(TIER_GRANTS.free.monthlyRuns);

    // The customer is stopped.
    expect(resolveTier(CUSTOMER)).toBe("free");
    expect((await canRunDesk({ email: CUSTOMER })).ok).toBe(false);

    // The deployment owner is not — the cap is never tested by loosening it,
    // it is tested by being a customer. OWNER_EMAIL is unset in the test env,
    // so this asserts the fallback in rbac.ownerEmail() is a real address and
    // not an empty string that would make every signed-in user the owner.
    const owner = await canRunDesk({ email: ownerEmail() });
    expect(ownerEmail()).toMatch(/@/);
    expect(owner.ok).toBe(true);
    expect(owner.status.limit).toBeNull();
  });

  it("treats a case- or whitespace-varied session email as one account", async () => {
    await consumeRuns(TIER_GRANTS.free.monthlyRuns);

    const shouted = await canRunDesk({ email: `  ${CUSTOMER.toUpperCase()}  ` });
    expect(shouted.ok).toBe(false);

    // And a missing actor gets the free tier, not the owner's unmetered one.
    const anon = await canRunDesk({ email: null });
    expect(anon.status.tier).toBe("free");
    expect(anon.status.used).toBe(0);
    expect(anon.status.limit).toBe(TIER_GRANTS.free.monthlyRuns);
  });

  it("reports a window that starts on the 1st and rolls forward", async () => {
    const { start, end } = monthWindowInclusive(new Date("2026-09-30T23:59:59Z"));
    expect(start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-01T00:00:00.000Z");

    const december = monthWindowInclusive(new Date("2026-12-15T12:00:00Z"));
    expect(december.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(december.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
