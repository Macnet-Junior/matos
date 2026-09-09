import { NextResponse } from "next/server";
import { requireMapManage } from "@/lib/owner";
import {
  buildEtsyAuthorizeUrl,
  etsyEnv,
  generatePkce,
} from "@/lib/integrations/etsy";
import {
  saveCredential,
  providerDbKey,
} from "@/lib/integrations/accounts";
import { prisma } from "@matos/db";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireMapManage();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const env = etsyEnv();
  if (!env.apiKey) {
    return NextResponse.json(
      {
        error:
          "ETSY_API_KEY not set. Add it to apps/web/.env.local then retry OAuth.",
      },
      { status: 400 },
    );
  }

  const { verifier, challenge } = generatePkce();
  const state = randomBytes(16).toString("hex");

  // Ensure account row exists
  await prisma.integrationAccount.upsert({
    where: { provider: "etsy" },
    create: {
      provider: "etsy",
      label: "Etsy",
      status: "disconnected",
      metaJson: JSON.stringify({ oauthStarted: true }),
    },
    update: {
      metaJson: JSON.stringify({ oauthStarted: true }),
      lastError: null,
    },
  });
  await saveCredential(providerDbKey("etsy"), "code_verifier", verifier);
  await saveCredential(providerDbKey("etsy"), "state", state);

  const url = buildEtsyAuthorizeUrl({
    apiKey: env.apiKey,
    redirectUri: env.redirectUri,
    state,
    codeChallenge: challenge,
  });

  return NextResponse.redirect(url);
}
