/**
 * Approved WhatsApp destinations.
 *
 * WHATSAPP_ALLOWED_TO is a comma-separated list (optional `label|destination`).
 * WHATSAPP_GROUP_OR_TO stays a one-item list and the default when a post
 * does not name a destination. There is no wildcard.
 */

export const WHATSAPP_ALLOWED_DESTINATION_CAP = 10;

const WILDCARD = new Set([
  "*",
  "anyone",
  "any",
  "all",
  "everybody",
  "everyone",
]);

export type WhatsAppDestination = {
  /** Value compared and sent. Phone numbers are normalised; other ids are trimmed. */
  to: string;
  label: string | null;
};

export type WhatsAppAllowlist = {
  destinations: WhatsAppDestination[];
  /** WHATSAPP_GROUP_OR_TO when it is still on the list, otherwise the first entry. */
  defaultTo: string | null;
  /** True when the env named more destinations than the cap. Extras are not approved. */
  overCap: boolean;
  rejectedCount: number;
};

export function isWhatsAppWildcard(value: string): boolean {
  return WILDCARD.has(value.trim().toLowerCase());
}

/**
 * Same comparison the send path uses.
 * Phone-like values drop spaces, dashes, dots, and parentheses.
 * Anything else is trimmed, which is what the single-destination check did.
 */
export function normalizeWhatsAppDestination(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const compact = trimmed.replace(/[\s().-]/g, "");
  if (/^\+?\d{6,15}$/.test(compact)) return compact;
  return trimmed;
}

export function maskWhatsAppDestination(raw: string): string {
  const value = normalizeWhatsAppDestination(raw);
  if (!value) return "";
  if (/^\+?\d{6,15}$/.test(value)) {
    const shown = value.startsWith("+") ? value : `+${value}`;
    if (shown.length <= 6) return `${"•".repeat(4)}${shown.slice(-2)}`;
    return `${shown.slice(0, 4)}${"•".repeat(4)}${shown.slice(-2)}`;
  }
  if (value.length <= 4) return "•".repeat(value.length);
  return `${value.slice(0, 2)}${"•".repeat(4)}${value.slice(-2)}`;
}

function parseOne(raw: string): WhatsAppDestination | null {
  const trimmed = raw.trim();
  if (!trimmed || isWhatsAppWildcard(trimmed)) return null;
  const pipe = trimmed.indexOf("|");
  let label: string | null = null;
  let value = trimmed;
  if (pipe >= 0) {
    const left = trimmed.slice(0, pipe).trim();
    const right = trimmed.slice(pipe + 1).trim();
    if (!right || isWhatsAppWildcard(left) || isWhatsAppWildcard(right)) return null;
    label = left || null;
    value = right;
  }
  const to = normalizeWhatsAppDestination(value);
  if (!to || isWhatsAppWildcard(to)) return null;
  return { to, label };
}

function dedupe(entries: WhatsAppDestination[]): WhatsAppDestination[] {
  const seen = new Set<string>();
  const out: WhatsAppDestination[] = [];
  for (const entry of entries) {
    if (seen.has(entry.to)) continue;
    seen.add(entry.to);
    out.push(entry);
  }
  return out;
}

export function parseWhatsAppAllowlist(input: {
  allowedTo?: string | null;
  legacyTo?: string | null;
}): WhatsAppAllowlist {
  const fromList: WhatsAppDestination[] = [];
  for (const part of (input.allowedTo ?? "").split(",")) {
    const entry = parseOne(part);
    if (entry) fromList.push(entry);
  }
  const legacy = parseOne(input.legacyTo ?? "");
  let merged = dedupe(fromList);
  if (legacy && !merged.some((entry) => entry.to === legacy.to)) {
    merged = [legacy, ...merged];
  }
  let overCap = false;
  let rejectedCount = 0;
  if (merged.length > WHATSAPP_ALLOWED_DESTINATION_CAP) {
    overCap = true;
    if (legacy) {
      const index = merged.findIndex((entry) => entry.to === legacy.to);
      if (index >= WHATSAPP_ALLOWED_DESTINATION_CAP) {
        const [kept] = merged.splice(index, 1);
        if (kept) merged = [kept, ...merged];
      }
    }
    rejectedCount = merged.length - WHATSAPP_ALLOWED_DESTINATION_CAP;
    merged = merged.slice(0, WHATSAPP_ALLOWED_DESTINATION_CAP);
  }
  const defaultTo =
    legacy && merged.some((entry) => entry.to === legacy.to)
      ? legacy.to
      : (merged[0]?.to ?? null);
  return { destinations: merged, defaultTo, overCap, rejectedCount };
}

export function whatsappAllowlistFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WhatsAppAllowlist {
  return parseWhatsAppAllowlist({
    allowedTo: env.WHATSAPP_ALLOWED_TO,
    legacyTo: env.WHATSAPP_GROUP_OR_TO,
  });
}

export type PublicWhatsAppDestination = {
  label: string | null;
  masked: string;
};

/** Safe for the browser. Never includes the full destination. */
export function publicWhatsAppAllowlist(list: WhatsAppAllowlist): {
  count: number;
  overCap: boolean;
  rejectedCount: number;
  destinations: PublicWhatsAppDestination[];
} {
  return {
    count: list.destinations.length,
    overCap: list.overCap,
    rejectedCount: list.rejectedCount,
    destinations: list.destinations.map((entry) => ({
      label: entry.label,
      masked: maskWhatsAppDestination(entry.to),
    })),
  };
}

export type WhatsAppDestinationChoice = {
  to: string;
  label: string;
  masked: string;
};

/** Options a Desk/Content form may offer. Visible text is the label and the mask. */
export function whatsappDestinationChoices(
  env: NodeJS.ProcessEnv = process.env,
): { options: WhatsAppDestinationChoice[]; defaultTo: string | null } {
  const list = whatsappAllowlistFromEnv(env);
  return {
    defaultTo: list.defaultTo,
    options: list.destinations.map((entry) => ({
      to: entry.to,
      label:
        entry.label ??
        (entry.to === list.defaultTo ? "Default destination" : "Approved destination"),
      masked: maskWhatsAppDestination(entry.to),
    })),
  };
}

function allowedValues(
  allowedTo: string | readonly string[] | null | undefined,
): string[] {
  if (allowedTo == null) return [];
  const items = typeof allowedTo === "string" ? [allowedTo] : [...allowedTo];
  return dedupe(
    items.flatMap((item) => {
      const to = normalizeWhatsAppDestination(item);
      if (!to || isWhatsAppWildcard(to)) return [];
      return [{ to, label: null }];
    }),
  ).map((entry) => entry.to);
}

/**
 * HARD BOUNDARY: destination must be one of the approved values.
 * A string allowlist is a one-item list (WHATSAPP_GROUP_OR_TO).
 */
export function assertWhatsAppDestinationAllowed(
  to: string,
  allowedTo: string | readonly string[] | null | undefined,
): { ok: true; to: string } | { ok: false; error: string } {
  const allowed = allowedValues(allowedTo);
  if (allowed.length === 0) {
    return {
      ok: false,
      error:
        "WhatsApp allowlist unset — set WHATSAPP_ALLOWED_TO or WHATSAPP_GROUP_OR_TO (approved destinations only)",
    };
  }
  if (isWhatsAppWildcard(to)) {
    return {
      ok: false,
      error: "WhatsApp destination rejected — there is no option to message anyone",
    };
  }
  const dest = normalizeWhatsAppDestination(to);
  if (!dest) {
    return { ok: false, error: "WhatsApp destination required" };
  }
  if (!allowed.includes(dest)) {
    return {
      ok: false,
      error: "WhatsApp destination rejected — that number is not on the approved list",
    };
  }
  return { ok: true, to: dest };
}
