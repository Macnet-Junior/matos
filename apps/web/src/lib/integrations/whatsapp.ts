/**
 * WhatsApp Cloud API wrapper with HARD destination allowlist.
 * Only WHATSAPP_GROUP_OR_TO may be messaged — all other destinations rejected.
 */

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
  /** Sole allowed destination (group or user id) */
  allowedTo: string;
  fetchImpl?: typeof fetch;
  graphBase?: string;
};

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export function whatsappAllowedDestination(): string | null {
  const v = process.env.WHATSAPP_GROUP_OR_TO?.trim();
  return v || null;
}

export function whatsappConfigFromEnv(): {
  token: string | null;
  phoneNumberId: string | null;
  allowedTo: string | null;
} {
  return {
    token: process.env.WHATSAPP_TOKEN?.trim() || null,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || null,
    allowedTo: whatsappAllowedDestination(),
  };
}

/**
 * HARD BOUNDARY: destination must exactly match configured allowlist.
 */
export function assertWhatsAppDestinationAllowed(
  to: string,
  allowedTo: string | null | undefined,
): { ok: true } | { ok: false; error: string } {
  const dest = to.trim();
  const allowed = (allowedTo ?? "").trim();
  if (!allowed) {
    return {
      ok: false,
      error:
        "WhatsApp allowlist unset — set WHATSAPP_GROUP_OR_TO (Career path / content creation monetization only)",
    };
  }
  if (!dest) {
    return { ok: false, error: "WhatsApp destination required" };
  }
  if (dest !== allowed) {
    return {
      ok: false,
      error:
        "WhatsApp destination rejected — only the configured Career path / content creation monetization destination is allowed",
    };
  }
  return { ok: true };
}

export class WhatsAppClient {
  private token: string;
  private phoneNumberId: string;
  private allowedTo: string;
  private fetchImpl: typeof fetch;
  private graphBase: string;

  constructor(opts: WhatsAppClientOptions) {
    this.token = opts.token;
    this.phoneNumberId = opts.phoneNumberId;
    this.allowedTo = opts.allowedTo;
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
        to: input.to.trim(),
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
        to: input.to.trim(),
      };
    }
    return {
      ok: true,
      messageId: body.messages?.[0]?.id,
      to: input.to.trim(),
    };
  }
}

/**
 * ContentPublisher adapter. Destination is always the configured allowlist
 * value — caller-supplied destinations are ignored.
 */
export class WhatsAppContentPublisher {
  constructor(
    private readonly opts: {
      allowedTo: string | null;
      token?: string | null;
      phoneNumberId?: string | null;
      fetchImpl?: typeof fetch;
    },
  ) {}

  async publish(input: {
    channel: string;
    body: string;
    idempotencyKey: string;
    approved?: boolean;
  }): Promise<{
    externalId: string;
    status: "planned" | "published";
    simulated: boolean;
    meta?: Record<string, unknown>;
  }> {
    if (input.channel !== "whatsapp") throw new Error("provider_error");
    if (!input.approved) throw new Error("approval_required");
    const destination = (this.opts.allowedTo ?? "").trim();
    const check = assertWhatsAppDestinationAllowed(destination, this.opts.allowedTo);
    if (!check.ok) throw new Error("destination_rejected");

    if (!this.opts.token || !this.opts.phoneNumberId) {
      const simulated = simulateWhatsAppSend({
        to: destination,
        text: input.body,
        allowedTo: this.opts.allowedTo,
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
      allowedTo: destination,
      fetchImpl: this.opts.fetchImpl,
    });
    const result = await client.sendText({
      to: destination,
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
  allowedTo: string | null;
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
    return { ok: false, error: check.error };
  }
  return {
    ok: true,
    simulated: true,
    messageId: `sim_wa_${Date.now()}`,
    to: input.to.trim(),
  };
}
