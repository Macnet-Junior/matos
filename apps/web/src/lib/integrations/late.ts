/**
 * Late.dev / Zernio social publishing client.
 * Default base: https://zernio.com/api/v1 (Late.dev rebranded to Zernio).
 * Override with LATE_API_BASE. Mockable via injected fetch.
 */

export type LateProfile = {
  _id: string;
  name: string;
  color?: string;
  isDefault?: boolean;
};

export type LateAccount = {
  _id: string;
  platform: string;
  username?: string;
  isActive?: boolean;
};

export type LateCreatePostInput = {
  content: string;
  platforms?: Array<{ platform: string; accountId: string }>;
  scheduledFor?: string;
  timezone?: string;
  publishNow?: boolean;
  isDraft?: boolean;
  queuedFromProfile?: string;
};

export type LatePostResult = {
  message?: string;
  post?: {
    _id: string;
    status?: string;
    scheduledFor?: string;
    platforms?: unknown[];
  };
  simulated?: boolean;
};

export type LateClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_BASE = "https://zernio.com/api/v1";

export function lateApiBase(): string {
  const raw = process.env.LATE_API_BASE?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return DEFAULT_BASE;
}

export class LateClient {
  private apiKey: string;
  private baseUrl: string;
  private fetchImpl: typeof fetch;

  constructor(opts: LateClientOptions) {
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? lateApiBase()).replace(/\/$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async request<T>(
    path: string,
    init?: RequestInit,
  ): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await this.fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text };
    }
    if (!res.ok) {
      const errMsg =
        typeof body === "object" &&
        body &&
        "error" in body &&
        typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : `Late API ${res.status}`;
      throw new Error(errMsg);
    }
    return body as T;
  }

  async listProfiles(): Promise<LateProfile[]> {
    const data = await this.request<{ profiles?: LateProfile[] }>("/profiles");
    return data.profiles ?? [];
  }

  async listAccounts(): Promise<LateAccount[]> {
    const data = await this.request<{ accounts?: LateAccount[] }>("/accounts");
    return data.accounts ?? [];
  }

  async createPost(input: LateCreatePostInput): Promise<LatePostResult> {
    return this.request<LatePostResult>("/posts", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getPost(id: string): Promise<LatePostResult> {
    return this.request<LatePostResult>(`/posts/${encodeURIComponent(id)}`);
  }
}

/** Dry-path helper when no key — returns simulated schedule result. */
export function simulateLateSchedule(input: {
  content: string;
  reason?: string;
}): LatePostResult {
  return {
    message: input.reason ?? "Simulated Late schedule (no API key / disconnected)",
    post: {
      _id: `sim_${Date.now()}`,
      status: "simulated",
      scheduledFor: new Date(Date.now() + 3600_000).toISOString(),
    },
    simulated: true,
  };
}
