export const CONTENT_PLATFORMS = [
  "linkedin",
  "x",
  "instagram",
  "facebook",
  "threads",
  "tiktok",
  "youtube",
  "pinterest",
  "reddit",
  "newsletter",
  "blog",
  "etsy",
  "whatsapp",
] as const;

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];

export const LATE_SOCIAL_PLATFORMS = [
  "linkedin",
  "x",
  "instagram",
  "facebook",
  "threads",
  "tiktok",
  "youtube",
  "pinterest",
  "reddit",
] as const satisfies readonly ContentPlatform[];

export type ContentPlatformLimits = {
  maxChars: number;
  requiresMedia: boolean;
};

export type ContentPlatformDefinition = {
  id: ContentPlatform;
  label: string;
  provider: "late-dev" | "etsy" | "whatsapp" | "native";
  capabilities: {
    text: boolean;
    images: boolean;
    video: boolean;
    links: boolean;
    scheduling: boolean;
    replies: boolean;
  };
  limits: ContentPlatformLimits;
};

export type ContentMedia = {
  kind: "image" | "video";
  ref: string;
};

export type ContentPackage = {
  channel: ContentPlatform;
  title: string;
  text: string;
  links: string[];
  media: ContentMedia[];
  hashtags: string[];
};

const SOCIAL_CAPABILITIES = {
  text: true,
  images: true,
  video: true,
  links: true,
  scheduling: true,
  replies: true,
} as const;

function social(
  id: ContentPlatform,
  label: string,
  limits: ContentPlatformLimits,
): ContentPlatformDefinition {
  return {
    id,
    label,
    provider: "late-dev",
    capabilities: SOCIAL_CAPABILITIES,
    limits,
  };
}

export const CONTENT_PLATFORM_DEFINITIONS: Record<
  ContentPlatform,
  ContentPlatformDefinition
> = {
  linkedin: social("linkedin", "LinkedIn", { maxChars: 3000, requiresMedia: false }),
  x: social("x", "X", { maxChars: 280, requiresMedia: false }),
  instagram: social("instagram", "Instagram", { maxChars: 2200, requiresMedia: true }),
  facebook: social("facebook", "Facebook", { maxChars: 63206, requiresMedia: false }),
  threads: social("threads", "Threads", { maxChars: 500, requiresMedia: false }),
  tiktok: social("tiktok", "TikTok", { maxChars: 2200, requiresMedia: true }),
  youtube: social("youtube", "YouTube", { maxChars: 5000, requiresMedia: true }),
  pinterest: social("pinterest", "Pinterest", { maxChars: 500, requiresMedia: true }),
  reddit: social("reddit", "Reddit", { maxChars: 40000, requiresMedia: false }),
  newsletter: {
    id: "newsletter",
    label: "Newsletter",
    provider: "native",
    capabilities: {
      text: true,
      images: true,
      video: false,
      links: true,
      scheduling: true,
      replies: false,
    },
    limits: { maxChars: 20000, requiresMedia: false },
  },
  blog: {
    id: "blog",
    label: "Blog",
    provider: "native",
    capabilities: {
      text: true,
      images: true,
      video: true,
      links: true,
      scheduling: true,
      replies: false,
    },
    limits: { maxChars: 100000, requiresMedia: false },
  },
  etsy: {
    id: "etsy",
    label: "Etsy",
    provider: "etsy",
    capabilities: {
      text: true,
      images: true,
      video: false,
      links: false,
      scheduling: false,
      replies: false,
    },
    limits: { maxChars: 10000, requiresMedia: true },
  },
  whatsapp: {
    id: "whatsapp",
    label: "WhatsApp",
    provider: "whatsapp",
    capabilities: {
      text: true,
      images: true,
      video: true,
      links: true,
      scheduling: false,
      replies: true,
    },
    limits: { maxChars: 4096, requiresMedia: false },
  },
};

export function isContentPlatform(value: string): value is ContentPlatform {
  return (CONTENT_PLATFORMS as readonly string[]).includes(value);
}

export function getContentPlatform(value: string): ContentPlatformDefinition {
  if (!isContentPlatform(value)) {
    throw new Error(`Unsupported content platform: ${value}`);
  }
  return CONTENT_PLATFORM_DEFINITIONS[value];
}

export function normalizeContentPlatforms(values: string[]): ContentPlatform[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()))].filter(
    isContentPlatform,
  );
}

export function validateContentPackage(pkg: ContentPackage): {
  ok: boolean;
  errors: string[];
} {
  const definition = getContentPlatform(pkg.channel);
  const errors: string[] = [];
  if (!pkg.text.trim()) errors.push("text is required");
  if (pkg.text.length > definition.limits.maxChars) {
    errors.push(`text exceeds ${definition.limits.maxChars} characters`);
  }
  if (definition.limits.requiresMedia && pkg.media.length === 0) {
    errors.push("media is required");
  }
  if (!definition.capabilities.links && pkg.links.length > 0) {
    errors.push("links are not supported");
  }
  if (!definition.capabilities.images && pkg.media.some((item) => item.kind === "image")) {
    errors.push("images are not supported");
  }
  if (!definition.capabilities.video && pkg.media.some((item) => item.kind === "video")) {
    errors.push("video is not supported");
  }
  if (!definition.capabilities.scheduling && pkg.channel === "whatsapp") {
    // Scheduling is a capability check performed by callers that pass a schedule.
  }
  return { ok: errors.length === 0, errors };
}

export function parseContentPackage(raw: string): ContentPackage | null {
  try {
    const value = JSON.parse(raw) as Partial<ContentPackage>;
    if (!value || typeof value.channel !== "string" || !isContentPlatform(value.channel)) {
      return null;
    }
    return {
      channel: value.channel,
      title: typeof value.title === "string" ? value.title : "",
      text: typeof value.text === "string" ? value.text : "",
      links: Array.isArray(value.links)
        ? value.links.filter((item): item is string => typeof item === "string")
        : [],
      media: Array.isArray(value.media)
        ? value.media.flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const rec = item as { kind?: unknown; ref?: unknown };
            if ((rec.kind !== "image" && rec.kind !== "video") || typeof rec.ref !== "string") {
              return [];
            }
            return [{ kind: rec.kind, ref: rec.ref }];
          })
        : [],
      hashtags: Array.isArray(value.hashtags)
        ? value.hashtags.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return null;
  }
}
