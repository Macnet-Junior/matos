/**
 * Etsy Open API v3 OAuth2 (PKCE) + shop/listing stubs.
 * Live calls when tokens present; otherwise mocked dry paths.
 */
import { createHash, randomBytes } from "crypto";

export type EtsyTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string | null;
};

export type EtsyShop = {
  shop_id: number | string;
  shop_name: string;
  title?: string;
  url?: string;
};

export type EtsyDraftListingInput = {
  title: string;
  description: string;
  price?: string;
  quantity?: number;
  who_made?: string;
  when_made?: string;
  taxonomy_id?: number;
};

export type EtsyClientOptions = {
  apiKey: string;
  accessToken?: string;
  fetchImpl?: typeof fetch;
  apiBase?: string;
};

const ETSY_API = "https://openapi.etsy.com/v3";
const ETSY_AUTH = "https://www.etsy.com/oauth/connect";
const ETSY_TOKEN = "https://api.etsy.com/v3/public/oauth/token";

export function etsyEnv() {
  return {
    apiKey: process.env.ETSY_API_KEY?.trim() || null,
    sharedSecret: process.env.ETSY_SHARED_SECRET?.trim() || null,
    redirectUri:
      process.env.ETSY_REDIRECT_URI?.trim() ||
      "http://localhost:3000/api/integrations/etsy/oauth/callback",
  };
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildEtsyAuthorizeUrl(input: {
  apiKey: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scopes?: string[];
}): string {
  const scopes = (
    input.scopes ?? [
      "shops_r",
      "shops_w",
      "listings_r",
      "listings_w",
    ]
  ).join(" ");
  const q = new URLSearchParams({
    response_type: "code",
    client_id: input.apiKey,
    redirect_uri: input.redirectUri,
    scope: scopes,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
  });
  return `${ETSY_AUTH}?${q.toString()}`;
}

export async function exchangeEtsyCode(input: {
  apiKey: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  fetchImpl?: typeof fetch;
}): Promise<EtsyTokens> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: input.apiKey,
    redirect_uri: input.redirectUri,
    code: input.code,
    code_verifier: input.codeVerifier,
  });
  const res = await fetchImpl(ETSY_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error ?? `Etsy token exchange failed (${res.status})`);
  }
  const expiresAt =
    typeof data.expires_in === "number"
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

export class EtsyClient {
  private apiKey: string;
  private accessToken: string | undefined;
  private fetchImpl: typeof fetch;
  private apiBase: string;

  constructor(opts: EtsyClientOptions) {
    this.apiKey = opts.apiKey;
    this.accessToken = opts.accessToken;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.apiBase = (opts.apiBase ?? ETSY_API).replace(/\/$/, "");
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = {
      "x-api-key": this.apiKey,
      Accept: "application/json",
    };
    if (this.accessToken) {
      h.Authorization = `Bearer ${this.accessToken}`;
    }
    return h;
  }

  async getMeShop(): Promise<EtsyShop | null> {
    if (!this.accessToken) {
      return simulateEtsyShop();
    }
    // Resolve user id then shop — simplified: try /application/shops/me pattern via user shops
    const res = await this.fetchImpl(`${this.apiBase}/application/users/me`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      // Fallback mock-friendly
      throw new Error(`Etsy users/me failed (${res.status})`);
    }
    const me = (await res.json()) as { user_id?: number };
    if (!me.user_id) return null;
    const shopsRes = await this.fetchImpl(
      `${this.apiBase}/application/users/${me.user_id}/shops`,
      { headers: this.headers() },
    );
    if (!shopsRes.ok) throw new Error(`Etsy shops failed (${shopsRes.status})`);
    const shops = (await shopsRes.json()) as {
      results?: EtsyShop[];
      shop_id?: number;
      shop_name?: string;
    };
    if (Array.isArray(shops.results) && shops.results[0]) {
      return shops.results[0];
    }
    if (shops.shop_id) {
      return {
        shop_id: shops.shop_id,
        shop_name: shops.shop_name ?? "Etsy Shop",
      };
    }
    return null;
  }

  async createDraftListing(
    shopId: string | number,
    input: EtsyDraftListingInput,
  ): Promise<{ listing_id?: string | number; simulated?: boolean }> {
    if (!this.accessToken) {
      return simulateEtsyDraft(input);
    }
    const res = await this.fetchImpl(
      `${this.apiBase}/application/shops/${shopId}/listings`,
      {
        method: "POST",
        headers: {
          ...this.headers(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...input,
          type: "physical",
          state: "draft",
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      listing_id?: number;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error ?? `Etsy create listing failed (${res.status})`);
    }
    return { listing_id: data.listing_id };
  }
}

export function simulateEtsyShop(): EtsyShop {
  return {
    shop_id: "sim_shop",
    shop_name: "MatOS Simulated Shop",
    title: "Simulated — connect Etsy OAuth for live data",
  };
}

export function simulateEtsyDraft(input: EtsyDraftListingInput) {
  return {
    listing_id: `sim_listing_${Date.now()}`,
    simulated: true as const,
    title: input.title,
  };
}

/** Map etsy-listing-lab skill fields into a draft listing payload. */
export function draftFromListingLab(fields: {
  title?: string;
  description?: string;
  price?: string;
}): EtsyDraftListingInput {
  return {
    title: fields.title?.trim() || "Untitled MatOS listing",
    description:
      fields.description?.trim() ||
      "Draft from etsy-listing-lab (MatOS Phase 4b)",
    price: fields.price ?? "9.99",
    quantity: 1,
    who_made: "i_did",
    when_made: "made_to_order",
  };
}
