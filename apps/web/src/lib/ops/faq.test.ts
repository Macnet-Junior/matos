import { describe, expect, it } from "vitest";
import {
  scoreFaqQuery,
  shouldEscalateToTicket,
  type FaqDoc,
} from "./faq";
import { assertCanEnableRule } from "./auto-response";

const docs: FaqDoc[] = [
  {
    path: "knowledge/support/billing-credits.md",
    title: "Billing & credits",
    content:
      "MatOS tracks stub credits. Stripe is not live. No refunds in chat.",
    tokens: [
      "billing",
      "credits",
      "matos",
      "tracks",
      "stub",
      "credits",
      "stripe",
      "not",
      "live",
      "refunds",
      "chat",
    ],
  },
  {
    path: "knowledge/support/channels-faq.md",
    title: "Channels FAQ",
    content: "Late.dev connect API key. WhatsApp allowlist only.",
    tokens: [
      "channels",
      "faq",
      "late",
      "connect",
      "api",
      "key",
      "whatsapp",
      "allowlist",
      "only",
    ],
  },
];

describe("FAQ matcher", () => {
  it("scores keyword overlap", () => {
    const matches = scoreFaqQuery("how do credits and stripe work?", docs);
    expect(matches[0]?.path).toContain("billing");
    expect(matches[0]!.score).toBeGreaterThan(0);
  });

  it("returns empty for unrelated query", () => {
    expect(scoreFaqQuery("zzzz unrelated xyzzy", docs)).toEqual([]);
  });

  it("escalates refund / billing reversal language", () => {
    expect(shouldEscalateToTicket("I want a refund please")).toBe(true);
    expect(shouldEscalateToTicket("money back now")).toBe(true);
    expect(shouldEscalateToTicket("how do I connect Late")).toBe(false);
  });
});

describe("auto-response allowlist gate", () => {
  it("blocks enable without approved gate", () => {
    const r = assertCanEnableRule({ role: "Owner", reviewGate: "pending" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/approved/i);
  });

  it("blocks Viewer even if approved", () => {
    const r = assertCanEnableRule({ role: "Viewer", reviewGate: "approved" });
    expect(r.ok).toBe(false);
  });

  it("allows Owner/Operator when approved", () => {
    expect(assertCanEnableRule({ role: "Owner", reviewGate: "approved" }).ok).toBe(
      true,
    );
    expect(
      assertCanEnableRule({ role: "Operator", reviewGate: "approved" }).ok,
    ).toBe(true);
  });
});
