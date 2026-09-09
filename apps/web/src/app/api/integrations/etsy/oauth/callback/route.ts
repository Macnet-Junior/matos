import { NextResponse } from "next/server";
import {
  etsyEnv,
  exchangeEtsyCode,
  EtsyClient,
} from "@/lib/integrations/etsy";
import {
  connectEtsyTokens,
  readCredential,
} from "@/lib/integrations/accounts";
import { prisma } from "@matos/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const base = process.env.AUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";

  if (err) {
    await prisma.integrationAccount.upsert({
      where: { provider: "etsy" },
      create: {
        provider: "etsy",
        status: "error",
        lastError: err,
        label: "Etsy",
      },
      update: { status: "error", lastError: err },
    });
    return NextResponse.redirect(
      `${base}/settings/channels?etsy=error&reason=${encodeURIComponent(err)}`,
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${base}/settings/channels?etsy=error&reason=missing_code`,
    );
  }

  const expectedState = await readCredential("etsy", "state");
  const verifier = await readCredential("etsy", "code_verifier");
  if (!expectedState || state !== expectedState || !verifier) {
    return NextResponse.redirect(
      `${base}/settings/channels?etsy=error&reason=state_mismatch`,
    );
  }

  const env = etsyEnv();
  if (!env.apiKey) {
    return NextResponse.redirect(
      `${base}/settings/channels?etsy=error&reason=missing_api_key`,
    );
  }

  try {
    const tokens = await exchangeEtsyCode({
      apiKey: env.apiKey,
      redirectUri: env.redirectUri,
      code,
      codeVerifier: verifier,
    });
    let shopId: string | null = null;
    let shopName: string | null = null;
    try {
      const client = new EtsyClient({
        apiKey: env.apiKey,
        accessToken: tokens.accessToken,
      });
      const shop = await client.getMeShop();
      if (shop) {
        shopId = String(shop.shop_id);
        shopName = shop.shop_name;
      }
    } catch {
      // Shop lookup optional at connect time
    }
    await connectEtsyTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      shopId,
      shopName,
    });
    // Drop one-time PKCE secrets
    const account = await prisma.integrationAccount.findUnique({
      where: { provider: "etsy" },
    });
    if (account) {
      await prisma.integrationCredential.deleteMany({
        where: {
          accountId: account.id,
          kind: { in: ["code_verifier", "state"] },
        },
      });
    }
    return NextResponse.redirect(`${base}/settings/channels?etsy=connected`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "oauth_failed";
    await prisma.integrationAccount.upsert({
      where: { provider: "etsy" },
      create: {
        provider: "etsy",
        status: "error",
        lastError: message,
        label: "Etsy",
      },
      update: { status: "error", lastError: message },
    });
    return NextResponse.redirect(
      `${base}/settings/channels?etsy=error&reason=${encodeURIComponent(message)}`,
    );
  }
}
