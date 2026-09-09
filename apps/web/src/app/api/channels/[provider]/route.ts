import { NextResponse } from "next/server";
import { requireMapManage } from "@/lib/owner";
import { appendActivity } from "@/lib/map-data";
import {
  connectLateWithApiKey,
  connectWhatsAppFromEnv,
  deleteCredentials,
  listChannelStatus,
  providerDbKey,
  fromDbKey,
} from "@/lib/integrations/accounts";
import type { ChannelProvider } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ provider: string }> };

function parseProvider(raw: string): ChannelProvider | null {
  return fromDbKey(raw) ?? (["late-dev", "etsy", "whatsapp"].includes(raw)
    ? (raw as ChannelProvider)
    : null);
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireMapManage();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { provider: raw } = await ctx.params;
  const provider = parseProvider(raw);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    apiKey?: string;
  };
  const action = body.action ?? "connect";

  try {
    if (action === "disconnect") {
      await deleteCredentials(providerDbKey(provider));
      await appendActivity({
        action: "channel.disconnect",
        entityType: "integration",
        entityId: provider,
        summary: `Disconnected ${provider}`,
        actorEmail: gate.email,
        payload: { provider },
      });
      const channels = await listChannelStatus();
      return NextResponse.json({
        channel: channels.find((c) => c.id === provider),
        channels,
      });
    }

    if (provider === "late-dev") {
      if (!body.apiKey?.trim()) {
        return NextResponse.json(
          { error: "apiKey required for Late.dev connect" },
          { status: 400 },
        );
      }
      const channel = await connectLateWithApiKey(body.apiKey);
      await appendActivity({
        action: "channel.connect",
        entityType: "integration",
        entityId: provider,
        summary: `Connected Late.dev (${channel.status})`,
        actorEmail: gate.email,
        payload: { provider, status: channel.status },
      });
      return NextResponse.json({ channel });
    }

    if (provider === "whatsapp") {
      const channel = await connectWhatsAppFromEnv();
      await appendActivity({
        action: "channel.connect",
        entityType: "integration",
        entityId: provider,
        summary: `Connected WhatsApp from env (${channel.status})`,
        actorEmail: gate.email,
        payload: { provider, status: channel.status },
      });
      return NextResponse.json({ channel });
    }

    if (provider === "etsy") {
      return NextResponse.json(
        {
          error: "Use /api/integrations/etsy/oauth/start for Etsy OAuth connect",
          oauthStart: "/api/integrations/etsy/oauth/start",
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connect failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
