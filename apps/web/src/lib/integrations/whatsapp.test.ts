import { describe, expect, it, vi } from "vitest";
import {
  providerConfigHealth,
  providerHealthSnapshot,
  resetProviderEvents,
} from "../content-observability";
import {
  assertWhatsAppDestinationAllowed,
  maskWhatsAppDestination,
  parseWhatsAppAllowlist,
  publicWhatsAppAllowlist,
  simulateWhatsAppSend,
  WhatsAppClient,
  WHATSAPP_ALLOWED_DESTINATION_CAP,
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

    resetProviderEvents();
    const bad = simulateWhatsAppSend({
      to: "other",
      text: "hi",
      allowedTo: "career-only",
      reviewGateApproved: true,
    });
    expect(bad.ok).toBe(false);
    expect(bad.messageId).toBeUndefined();
    expect(providerHealthSnapshot().providers.whatsapp?.failures).toBe(1);
  });

  it("allows a destination on the approved list, including a label and phone spacing", () => {
    const list = parseWhatsAppAllowlist({
      allowedTo: "Career path| +237 612-345-612 , Shop|+237699000011",
    });
    expect(list.destinations.map((entry) => entry.to)).toEqual([
      "+237612345612",
      "+237699000011",
    ]);
    expect(list.destinations[0]?.label).toBe("Career path");
    const allowed = list.destinations.map((entry) => entry.to);
    const ok = assertWhatsAppDestinationAllowed("+237 612 345 612", allowed);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.to).toBe("+237612345612");

    const sent = simulateWhatsAppSend({
      to: "Shop|+237699000011".split("|")[1]!,
      text: "hi",
      allowedTo: allowed,
      reviewGateApproved: true,
    });
    expect(sent.ok).toBe(true);
    expect(sent.to).toBe("+237699000011");
  });

  it("rejects a destination that is not on the list and does not send it", async () => {
    const allowed = ["+237612345612"];
    resetProviderEvents();
    const rejected = assertWhatsAppDestinationAllowed("+237600000000", allowed);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error).toMatch(/not on the approved list/i);
    }

    const wildcard = assertWhatsAppDestinationAllowed("*", allowed);
    expect(wildcard.ok).toBe(false);
    if (!wildcard.ok) expect(wildcard.error).toMatch(/anyone/i);

    const fetchImpl = vi.fn();
    const client = new WhatsAppClient({
      token: "token",
      phoneNumberId: "phone",
      allowedTo: allowed,
      fetchImpl,
    });
    const result = await client.sendText({
      to: "+237600000000",
      text: "hi",
      reviewGateApproved: true,
    });
    expect(result.ok).toBe(false);
    expect(result.messageId).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(providerHealthSnapshot().providers.whatsapp?.failures).toBeGreaterThan(0);
  });

  it("keeps WHATSAPP_GROUP_OR_TO as the one-item default", () => {
    const list = parseWhatsAppAllowlist({
      legacyTo: "career-only",
    });
    expect(list.destinations.map((entry) => entry.to)).toEqual(["career-only"]);
    expect(list.defaultTo).toBe("career-only");
    expect(list.overCap).toBe(false);

    const withList = parseWhatsAppAllowlist({
      allowedTo: "Shop|+237699000011, Career path|+237612345612",
      legacyTo: "+237 612-345-612",
    });
    expect(withList.defaultTo).toBe("+237612345612");
    expect(withList.destinations.map((entry) => entry.to)).toEqual([
      "+237699000011",
      "+237612345612",
    ]);
    expect(assertWhatsAppDestinationAllowed("career-only", ["career-only"]).ok).toBe(true);
    expect(assertWhatsAppDestinationAllowed("other-group", ["career-only"]).ok).toBe(false);

    const legacyHealth = providerConfigHealth({
      NODE_ENV: "test",
      WHATSAPP_TOKEN: "token",
      WHATSAPP_PHONE_NUMBER_ID: "phone",
      WHATSAPP_GROUP_OR_TO: "career-only",
    });
    expect(legacyHealth.find((item) => item.provider === "whatsapp")?.mode).toBe(
      "live-configured",
    );
    const listHealth = providerConfigHealth({
      NODE_ENV: "test",
      WHATSAPP_TOKEN: "token",
      WHATSAPP_PHONE_NUMBER_ID: "phone",
      WHATSAPP_ALLOWED_TO: "Career path|+237612345612",
    });
    expect(listHealth.find((item) => item.provider === "whatsapp")?.mode).toBe(
      "live-configured",
    );
  });

  it("caps the approved list and rejects the extras", () => {
    const numbers = Array.from(
      { length: WHATSAPP_ALLOWED_DESTINATION_CAP + 1 },
      (_, index) => `+237700000${String(index).padStart(2, "0")}`,
    );
    const list = parseWhatsAppAllowlist({ allowedTo: numbers.join(",") });
    expect(list.destinations).toHaveLength(WHATSAPP_ALLOWED_DESTINATION_CAP);
    expect(list.overCap).toBe(true);
    expect(list.rejectedCount).toBe(1);
    expect(list.defaultTo).toBe(numbers[0]);
    const allowed = list.destinations.map((entry) => entry.to);
    expect(assertWhatsAppDestinationAllowed(numbers[0]!, allowed).ok).toBe(true);
    expect(assertWhatsAppDestinationAllowed(numbers[10]!, allowed).ok).toBe(false);

    const starred = parseWhatsAppAllowlist({ allowedTo: "*, anyone, +237612345612" });
    expect(starred.destinations.map((entry) => entry.to)).toEqual(["+237612345612"]);
  });

  it("masks destinations and never returns the full number", () => {
    expect(maskWhatsAppDestination("+237612345612")).toBe("+237••••12");
    expect(maskWhatsAppDestination(" +237 612-345-612 ")).toBe("+237••••12");
    const list = parseWhatsAppAllowlist({
      allowedTo: "Career path|+237612345612",
      legacyTo: "career-only",
    });
    const pub = publicWhatsAppAllowlist(list);
    expect(pub.count).toBe(2);
    expect(pub.destinations.map((entry) => entry.masked)).toContain("+237••••12");
    const serialized = JSON.stringify(pub);
    expect(serialized).not.toContain("612345612");
    expect(serialized).not.toContain("career-only");
    expect(serialized).toContain("+237••••12");
  });
});
