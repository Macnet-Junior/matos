/**
 * WhatsApp Cloud API wrapper with a hard destination allowlist.
 * Only destinations on WHATSAPP_ALLOWED_TO, plus the legacy WHATSAPP_GROUP_OR_TO
 * entry, may be messaged. Anything else is rejected, logged, and never sent.
 */

import { recordProviderEvent } from "../content-observability";
import {
  assertWhatsAppDestinationAllowed,
  whatsappAllowlistFromEnv,
  type WhatsAppAllowlist,
} from "./whatsapp-destinations";

export {
  assertWhatsAppDestinationAllowed,
  maskWhatsAppDestination,
  normalizeWhatsAppDestination,
  parseWhatsAppAllowlist,
  publicWhatsAppAllowlist,
  whatsappAllowlistFromEnv,
  whatsappDestinationChoices,
  WHATSAPP_ALLOWED_DESTINATION_CAP,
} from "./whatsapp-destinations";
export type {
  WhatsAppAllowlist,
  WhatsAppDestination,
  WhatsAppDestinationChoice,
} from "./whatsapp-destinations";

export type WhatsAppSendInput = {
  to: string;
  text: string;
  /** Must be true — review gate approved before send */
  reviewGateApproved: boolean;
};

export type WhatsAppSendResult = {
  ok: boolean;
  simulated?: boolean;
  messageId?: string;
  error?: string;
  to?: string;
};

export type WhatsAppClientOptions = {
  token: string;
  phoneNumberId: string;
  /** Approved destinations. A string is a one-item list (legacy). */
  allowedTo: string | readonly string[];
  fetchImpl?: typeof fetch;
  graphBase?: string;
};

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

function logDestinationRejected(): void {
  recordProviderEvent({
    provider: "whatsapp",
    kind: "delivery",
    ok: false,
    simulated: false,
    reason: "destination_rejected",
  });
}

/** Legacy single destination: WHATSAPP_GROUP_OR_TO, else the first approved entry. */
export function whatsappAllowedDestination(): string | null {
  return whatsappAllowlistFromEnv().defaultTo;
}

export function whatsappConfigFromEnv(): {
  token: string | null;
  phoneNumberId: string | null;
  /** Default destination when a post does not name one. */
  allowedTo: string | null;
  allowlist: WhatsAppAllowlist;
} {
  const allowlist = whatsappAllowlistFromEnv();
  return {
    token: process.env.WHATSAPP_TOKEN?.trim() || null,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null,
    allowedTo: allowlist.defaultTo,
    allowlist,
  };
}

export class WhatsAppClient {
  private token: string;
  private phoneNumberId: string;
  private allowedTo: readonly string[];
  private fetchImpl: typeof fetch;
  private graphBase: string;

  constructor(opts: WhatsAppClientOptions) {
    this.token = opts.token;
    this.phoneNumberId = opts.phoneNumberId;
    this.allowedTo = typeof opts.allowedTo === "string" ? [opts.allowedTo] : opts.allowedTo;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.graphBase = (opts.graphBase ?? GRAPH_BASE).replace(/\/$/, "");
  }

  async sendText(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    if (!input.reviewGateApproved) {
      return {
        ok: false,
        error: "WhatsApp send requires review gate approved (or scheduled/published)",
      };
    }
    const check = assertWhatsAppDestinationAllowed(input.to, this.allowedTo);
    if (!check.ok) {
      logDestinationRejected();
      return { ok: false, error: check.error };
    }

    const url = `${this.graphBase}/${this.phoneNumberId}/messages`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: check.to,
        type: "text",
        text: { body: input.text },
      }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id?: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        error: body.error?.message ?? `WhatsApp API ${res.status}`,
        to: check.to,
      };
    }
    return {
      ok: true,
      messageId: body.messages?.[0]?.id,
      to: check.to,
    };
  }
}

/**
 * ContentPublisher adapter. A named destination must be on the approved list.
 * When a post does not name one, the legacy default (or the only entry) is used.
 */
export class WhatsAppContentPublisher {
  constructor(
    private readonly opts: {
      allowedTo: string | readonly string[] | null;
      defaultTo?: string | null;
      token?: string | null;
      phoneNumberId?: string | null;
      fetchImpl?: typeof fetch;
    },
  ) {}

  private allowedList(): readonly string[] {
    if (this.opts.allowedTo == null) return [];
    return typeof this.opts.allowedTo === "string" ? [this.opts.allowedTo] : this.opts.allowedTo;
  }

  private destinationFor(requested: string | null | undefined): string {
    const asked = (requested ?? "").trim();
    if (asked) return asked;
    const fallback = this.opts.defaultTo?.trim();
    if (fallback) return fallback;
    const list = this.allowedList();
    return list.length === 1 ? list[0]! : "";
  }

  async publish(input: {
    channel: string;
    body: string;
    idempotencyKey: string;
    approved?: boolean;
    to?: string | null;
  }): Promise<{
    externalId: string;
    status: "planned" | "published";
    simulated: boolean;
    meta?: Record<string, unknown>;
  }> {
    if (input.channel !== "whatsapp") throw new Error("provider_error");
    if (!input.approved) throw new Error("approval_required");
    const destination = this.destinationFor(input.to);
    const allowed = this.allowedList();
    const check = assertWhatsAppDestinationAllowed(destination, allowed);
    if (!check.ok) throw new Error("destination_rejected");

    if (!this.opts.token || !this.opts.phoneNumberId) {
      const simulated = simulateWhatsAppSend({
        to: check.to,
        text: input.body,
        allowedTo: allowed,
        reviewGateApproved: true,
      });
      if (!simulated.ok || !simulated.messageId) throw new Error("destination_rejected");
      return {
        externalId: simulated.messageId,
        status: "published",
        simulated: true,
        meta: { provider: "whatsapp", deliveryStatus: "simulated" },
      };
    }

    const client = new WhatsAppClient({
      token: this.opts.token,
      phoneNumberId: this.opts.phoneNumberId,
      allowedTo: allowed,
      fetchImpl: this.opts.fetchImpl,
    });
    const result = await client.sendText({
      to: check.to,
      text: input.body,
      reviewGateApproved: true,
    });
    if (!result.ok || !result.messageId) throw new Error("provider_error");
    return {
      externalId: result.messageId,
      status: "published",
      simulated: false,
      meta: { provider: "whatsapp", deliveryStatus: "published" },
    };
  }
}

export function simulateWhatsAppSend(input: {
  to: string;
  text: string;
  allowedTo: string | readonly string[] | null;
  reviewGateApproved: boolean;
}): WhatsAppSendResult {
  if (!input.reviewGateApproved) {
    return {
      ok: false,
      error: "WhatsApp send requires review gate approved",
    };
  }
  const check = assertWhatsAppDestinationAllowed(input.to, input.allowedTo);
  if (!check.ok) {
    logDestinationRejected();
    return { ok: false, error: check.error };
  }
  return {
    ok: true,
    simulated: true,
    messageId: `sim_wa_${Date.now()}`,
    to: check.to,
  };
}
