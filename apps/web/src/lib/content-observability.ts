export type ProviderEventKind = "health" | "delivery" | "fallback";

export type SafeProviderReason =
  | "provider_error"
  | "provider_timeout"
  | "provider_unavailable"
  | "destination_rejected"
  | "approval_required";

export type ProviderHealthEvent = {
  provider: string;
  kind: ProviderEventKind;
  ok: boolean;
  simulated: boolean;
  reason?: SafeProviderReason;
  at: string;
};

const MAX_EVENTS = 200;
const events: ProviderHealthEvent[] = [];

const SECRET_PATTERN =
  /bearer\s+[a-z0-9._\-]+|sk_(live|test)_[a-z0-9]+|api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password/gi;

export function redactSensitive(value: string): string {
  return value.replace(SECRET_PATTERN, "[redacted]");
}

export function recordProviderEvent(
  event: Omit<ProviderHealthEvent, "at"> & { at?: string },
): void {
  events.push({
    provider: event.provider,
    kind: event.kind,
    ok: event.ok,
    simulated: event.simulated,
    reason: event.reason,
    at: event.at ?? new Date().toISOString(),
  });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

export function providerHealthSnapshot(): {
  providers: Record<
    string,
    { deliveries: number; fallbacks: number; failures: number; simulated: number }
  >;
} {
  const providers: Record<
    string,
    { deliveries: number; fallbacks: number; failures: number; simulated: number }
  > = {};
  for (const event of events) {
    const row = providers[event.provider] ?? {
      deliveries: 0,
      fallbacks: 0,
      failures: 0,
      simulated: 0,
    };
    if (event.kind === "delivery") row.deliveries += 1;
    if (event.kind === "fallback") row.fallbacks += 1;
    if (!event.ok) row.failures += 1;
    if (event.simulated) row.simulated += 1;
    providers[event.provider] = row;
  }
  return { providers };
}

export function resetProviderEvents(): void {
  events.length = 0;
}

export type ProviderConfigHealth = {
  provider: string;
  configured: boolean;
  mode: "live-configured" | "simulated";
};

/** Local configuration check. Does not call providers or read secret values. */
export function providerConfigHealth(env: NodeJS.ProcessEnv = process.env): ProviderConfigHealth[] {
  const late = Boolean(env.LATE_API_KEY?.trim());
  const etsy = Boolean(env.ETSY_API_KEY?.trim());
  const whatsapp = Boolean(
    env.WHATSAPP_TOKEN?.trim() &&
      env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
      env.WHATSAPP_GROUP_OR_TO?.trim(),
  );
  const newsletter = Boolean(env.NEWSLETTER_DELIVERY_URL?.trim());
  const blog = Boolean(env.BLOG_DELIVERY_URL?.trim());
  return [
    { provider: "late-dev", configured: late, mode: late ? "live-configured" : "simulated" },
    { provider: "etsy", configured: etsy, mode: etsy ? "live-configured" : "simulated" },
    {
      provider: "whatsapp",
      configured: whatsapp,
      mode: whatsapp ? "live-configured" : "simulated",
    },
    {
      provider: "newsletter",
      configured: newsletter,
      mode: newsletter ? "live-configured" : "simulated",
    },
    { provider: "blog", configured: blog, mode: blog ? "live-configured" : "simulated" },
  ];
}
