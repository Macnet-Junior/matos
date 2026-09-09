/**
 * IntegrationAccount + encrypted credential persistence.
 * Never returns plaintext secrets to callers that might serialize to clients.
 */
import { prisma, parseJsonObject } from "@matos/db";
import { decryptSecret, encryptSecret, maskSecret } from "./credentials";
import { lateApiBase, LateClient } from "./late";
import { etsyEnv } from "./etsy";
import { whatsappConfigFromEnv } from "./whatsapp";
import type { ChannelDTO, ChannelProvider, ChannelStatus } from "../types";

export const PROVIDERS: ChannelProvider[] = ["late-dev", "etsy", "whatsapp"];

export function providerDbKey(provider: ChannelProvider): string {
  if (provider === "late-dev") return "late";
  return provider;
}

export function fromDbKey(key: string): ChannelProvider | null {
  if (key === "late" || key === "late-dev") return "late-dev";
  if (key === "etsy") return "etsy";
  if (key === "whatsapp") return "whatsapp";
  return null;
}

async function upsertAccount(input: {
  provider: string;
  label?: string;
  status: ChannelStatus;
  externalId?: string | null;
  meta?: Record<string, unknown>;
  lastError?: string | null;
}) {
  const existing = await prisma.integrationAccount.findUnique({
    where: { provider: input.provider },
  });
  const metaJson = JSON.stringify(input.meta ?? {});
  if (existing) {
    return prisma.integrationAccount.update({
      where: { id: existing.id },
      data: {
        label: input.label ?? existing.label,
        status: input.status,
        externalId: input.externalId ?? existing.externalId,
        metaJson,
        lastError: input.lastError ?? null,
        connectedAt:
          input.status === "connected"
            ? existing.connectedAt ?? new Date()
            : null,
      },
    });
  }
  return prisma.integrationAccount.create({
    data: {
      provider: input.provider,
      label: input.label ?? "",
      status: input.status,
      externalId: input.externalId ?? null,
      metaJson,
      lastError: input.lastError ?? null,
      connectedAt: input.status === "connected" ? new Date() : null,
    },
  });
}

export async function saveCredential(
  providerKey: string,
  kind: string,
  plaintext: string,
  expiresAt?: Date | null,
) {
  const account = await prisma.integrationAccount.findUnique({
    where: { provider: providerKey },
  });
  if (!account) {
    throw new Error(`Integration account missing for ${providerKey}`);
  }
  const blob = encryptSecret(plaintext);
  await prisma.integrationCredential.upsert({
    where: {
      accountId_kind: { accountId: account.id, kind },
    },
    create: {
      accountId: account.id,
      kind,
      ciphertext: blob.ciphertext,
      iv: blob.iv,
      authTag: blob.authTag,
      expiresAt: expiresAt ?? null,
    },
    update: {
      ciphertext: blob.ciphertext,
      iv: blob.iv,
      authTag: blob.authTag,
      expiresAt: expiresAt ?? null,
    },
  });
}

export async function readCredential(
  providerKey: string,
  kind: string,
): Promise<string | null> {
  const account = await prisma.integrationAccount.findUnique({
    where: { provider: providerKey },
    include: { credentials: true },
  });
  const row = account?.credentials.find((c) => c.kind === kind);
  if (!row) return null;
  try {
    return decryptSecret({
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.authTag,
    });
  } catch {
    return null;
  }
}

export async function deleteCredentials(providerKey: string) {
  const account = await prisma.integrationAccount.findUnique({
    where: { provider: providerKey },
  });
  if (!account) return;
  await prisma.integrationCredential.deleteMany({
    where: { accountId: account.id },
  });
  await prisma.integrationAccount.update({
    where: { id: account.id },
    data: {
      status: "disconnected",
      lastError: null,
      connectedAt: null,
      externalId: null,
      metaJson: "{}",
    },
  });
}

/** Resolve Late API key: DB credential first, then LATE_API_KEY env. */
export async function resolveLateApiKey(): Promise<{
  key: string | null;
  source: "db" | "env" | null;
}> {
  const fromDb = await readCredential("late", "api_key");
  if (fromDb) return { key: fromDb, source: "db" };
  const env = process.env.LATE_API_KEY?.trim();
  if (env) return { key: env, source: "env" };
  return { key: null, source: null };
}

export async function connectLateWithApiKey(apiKey: string): Promise<ChannelDTO> {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error("API key required");

  await upsertAccount({
    provider: "late",
    label: "Late.dev / Zernio",
    status: "disconnected",
  });
  await saveCredential("late", "api_key", trimmed);

  try {
    const client = new LateClient({
      apiKey: trimmed,
      baseUrl: lateApiBase(),
    });
    const profiles = await client.listProfiles();
    await upsertAccount({
      provider: "late",
      label: "Late.dev / Zernio",
      status: "connected",
      externalId: profiles[0]?._id ?? null,
      meta: {
        profileCount: profiles.length,
        defaultProfileName: profiles[0]?.name ?? null,
        apiBase: lateApiBase(),
        source: "db",
      },
    });
  } catch (err) {
    // Scaffold: store key even if verify fails (offline / bad key) — mark error
    const message = err instanceof Error ? err.message : "Late verify failed";
    await upsertAccount({
      provider: "late",
      label: "Late.dev / Zernio",
      status: "error",
      lastError: message,
      meta: { apiBase: lateApiBase(), source: "db", verifyFailed: true },
    });
  }
  return (await listChannelStatus()).find((c) => c.id === "late-dev")!;
}

export async function connectEtsyTokens(input: {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string | null;
  shopId?: string | null;
  shopName?: string | null;
}) {
  await upsertAccount({
    provider: "etsy",
    label: input.shopName ?? "Etsy",
    status: "connected",
    externalId: input.shopId ?? null,
    meta: {
      shopName: input.shopName ?? null,
      source: "oauth",
    },
  });
  await saveCredential("etsy", "access_token", input.accessToken);
  if (input.refreshToken) {
    await saveCredential("etsy", "refresh_token", input.refreshToken);
  }
}

export async function connectWhatsAppFromEnv(): Promise<ChannelDTO> {
  const cfg = whatsappConfigFromEnv();
  if (!cfg.token || !cfg.phoneNumberId || !cfg.allowedTo) {
    throw new Error(
      "Set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_GROUP_OR_TO",
    );
  }
  await upsertAccount({
    provider: "whatsapp",
    label: "Career path / content creation monetization",
    status: "connected",
    externalId: cfg.phoneNumberId,
    meta: {
      allowedTo: cfg.allowedTo,
      allowedLabel: "Career path and content creation monetization",
      phoneNumberId: cfg.phoneNumberId,
      source: "env",
    },
  });
  await saveCredential("whatsapp", "api_key", cfg.token);
  return (await listChannelStatus()).find((c) => c.id === "whatsapp")!;
}

function coverageFor(
  provider: ChannelProvider,
  status: ChannelStatus,
): ChannelDTO["coverage"] {
  const connected = status === "connected";
  if (provider === "late-dev") {
    return {
      api: connected ? "ready" : "disconnected",
      scheduled: connected ? "ready" : "handoff",
      handoff: "available",
      disconnected: connected ? "n/a" : "yes",
    };
  }
  if (provider === "etsy") {
    return {
      api: connected ? "ready" : "disconnected",
      scheduled: "handoff",
      handoff: "available",
      disconnected: connected ? "n/a" : "yes",
    };
  }
  return {
    api: connected ? "ready" : "disconnected",
    scheduled: "n/a",
    handoff: connected ? "gated" : "available",
    disconnected: connected ? "n/a" : "yes",
  };
}

export async function listChannelStatus(): Promise<ChannelDTO[]> {
  const rows = await prisma.integrationAccount.findMany();
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  const lateKey = await resolveLateApiKey();
  const etsy = etsyEnv();
  const wa = whatsappConfigFromEnv();

  const lateRow = byProvider.get("late");
  let lateStatus: ChannelStatus =
    (lateRow?.status as ChannelStatus) || "disconnected";
  if (!lateRow && lateKey.key) lateStatus = "connected";
  if (lateRow?.status === "error") lateStatus = "error";

  const etsyRow = byProvider.get("etsy");
  let etsyStatus: ChannelStatus =
    (etsyRow?.status as ChannelStatus) || "disconnected";
  if (!etsyRow && etsy.apiKey && (await readCredential("etsy", "access_token"))) {
    etsyStatus = "connected";
  }

  const waRow = byProvider.get("whatsapp");
  let waStatus: ChannelStatus =
    (waRow?.status as ChannelStatus) || "disconnected";
  if (!waRow && wa.token && wa.phoneNumberId && wa.allowedTo) {
    waStatus = "connected";
  }

  const lateMeta = lateRow ? parseJsonObject(lateRow.metaJson) : {};
  const etsyMeta = etsyRow ? parseJsonObject(etsyRow.metaJson) : {};
  const waMeta = waRow ? parseJsonObject(waRow.metaJson) : {};

  const lateHint = lateKey.key ? maskSecret(lateKey.key) : null;

  return [
    {
      id: "late-dev",
      name: "Late.dev",
      status: lateStatus,
      note:
        lateStatus === "connected"
          ? "API key stored server-side. Schedule/publish when review gate is approved."
          : "Paste a Late/Zernio API key to connect. Without a key, publish stays simulated.",
      phase: "Phase 4b",
      connectMode: "api_key",
      maskedHint: lateHint,
      lastError: lateRow?.lastError ?? null,
      externalId: lateRow?.externalId ?? null,
      meta: {
        ...lateMeta,
        apiBase: lateApiBase(),
        keySource: lateKey.source,
      },
      coverage: coverageFor("late-dev", lateStatus),
      allowedDestination: null,
    },
    {
      id: "etsy",
      name: "Etsy",
      status: etsyStatus,
      note:
        etsyStatus === "connected"
          ? "OAuth tokens stored server-side. Draft listings from etsy-listing-lab when connected."
          : "Connect via Etsy Open API v3 OAuth (PKCE). Set ETSY_API_KEY + ETSY_REDIRECT_URI first.",
      phase: "Phase 4b",
      connectMode: "oauth",
      maskedHint: null,
      lastError: etsyRow?.lastError ?? null,
      externalId: etsyRow?.externalId ?? null,
      meta: {
        ...etsyMeta,
        envKeyConfigured: Boolean(etsy.apiKey),
        redirectUri: etsy.redirectUri,
      },
      coverage: coverageFor("etsy", etsyStatus),
      allowedDestination: null,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      status: waStatus,
      note:
        "HARD BOUNDARY: only the configured Career path / content creation monetization destination. Review gate required before send.",
      phase: "Phase 4b",
      connectMode: "env",
      maskedHint: wa.token ? maskSecret(wa.token) : null,
      lastError: waRow?.lastError ?? null,
      externalId: waRow?.externalId ?? wa.phoneNumberId,
      meta: {
        ...waMeta,
        envConfigured: Boolean(wa.token && wa.phoneNumberId && wa.allowedTo),
      },
      coverage: coverageFor("whatsapp", waStatus),
      allowedDestination: wa.allowedTo
        ? {
            id: wa.allowedTo,
            label: "Career path and content creation monetization",
          }
        : {
            id: null,
            label: "Career path and content creation monetization (set WHATSAPP_GROUP_OR_TO)",
          },
    },
  ];
}

export async function isLateConnected(): Promise<boolean> {
  const channels = await listChannelStatus();
  const late = channels.find((c) => c.id === "late-dev");
  return late?.status === "connected";
}
