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
};

const SOCIAL_CAPABILITIES = {
  text: true,
  images: true,
  video: true,
  links: true,
  scheduling: true,
  replies: true,
} as const;

export const CONTENT_PLATFORM_DEFINITIONS: Record<
  ContentPlatform,
  ContentPlatformDefinition
> = {
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    provider: "late-dev",
    capabilities: SOCIAL_CAPABILITIES,
  },
  x: {
    id: "x",
    label: "X",
    provider: "late-dev",
    capabilities: SOCIAL_CAPABILITIES,
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    provider: "late-dev",
    capabilities: SOCIAL_CAPABILITIES,
  },
  facebook: {
    id: "facebook",
    label: "Facebook",
    provider: "late-dev",
    capabilities: SOCIAL_CAPABILITIES,
  },
  threads: {
    id: "threads",
    label: "Threads",
    provider: "late-dev",
    capabilities: SOCIAL_CAPABILITIES,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    provider: "late-dev",
    capabilities: SOCIAL_CAPABILITIES,
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    provider: "late-dev",
    capabilities: SOCIAL_CAPABILITIES,
  },
  pinterest: {
    id: "pinterest",
    label: "Pinterest",
    provider: "late-dev",
    capabilities: SOCIAL_CAPABILITIES,
  },
  reddit: {
    id: "reddit",
    label: "Reddit",
    provider: "late-dev",
    capabilities: SOCIAL_CAPABILITIES,
  },
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