import { describe, expect, it } from "vitest";
import {
  assertWhatsAppDestinationAllowed,
  simulateWhatsAppSend,
} from "./whatsapp";

describe("WhatsApp destination allowlist", () => {
  it("rejects when allowlist unset", () => {
    const r = assertWhatsAppDestinationAllowed("123", null);
    expect(r.ok).toBe(false);
  });

  it("rejects non-matching destination", () => {
    const r = assertWhatsAppDestinationAllowed("evil-group", "career-only");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/rejected/i);
    }
  });

  it("allows exact configured destination", () => {
    const r = assertWhatsAppDestinationAllowed("career-only", "career-only");
    expect(r.ok).toBe(true);
  });

  it("blocks send without review gate", () => {
    const r = simulateWhatsAppSend({
      to: "career-only",
      text: "hi",
      allowedTo: "career-only",
      reviewGateApproved: false,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/review gate/i);
  });

  it("simulates send only to allowlisted dest with gate", () => {
    const ok = simulateWhatsAppSend({
      to: "career-only",
      text: "hi",
      allowedTo: "career-only",
      reviewGateApproved: true,
    });
    expect(ok.ok).toBe(true);
    expect(ok.simulated).toBe(true);

    const bad = simulateWhatsAppSend({
      to: "other",
      text: "hi",
      allowedTo: "career-only",
      reviewGateApproved: true,
    });
    expect(bad.ok).toBe(false);
  });
});
