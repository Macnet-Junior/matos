import {
  isContentPlatform,
  validateContentPackage,
  type ContentPackage,
  type ContentPlatform,
} from "@/lib/content-platforms";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Pull the `## channel` section out of an approved Press artifact. */
export function extractPressChannelSection(body: string, channel: string): string | null {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const header = new RegExp(`^##\\s+${escapeRegExp(channel)}\\s*$`, "i");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (header.test(lines[i]!.trim())) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return null;
  const chunk: string[] = [];
  for (let i = start; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i]!.trim())) break;
    chunk.push(lines[i]!);
  }
  const text = chunk.join("\n").trim();
  return text || null;
}

export function buildChannelPackage(input: {
  channel: string;
  pressBody: string;
  title: string;
  topic: string;
  offerCta: string;
}): ContentPackage | null {
  if (!isContentPlatform(input.channel)) return null;
  const section = extractPressChannelSection(input.pressBody, input.channel);
  const text = section ?? [input.topic.trim(), input.offerCta.trim()].filter(Boolean).join("\n\n");
  const links = [...text.matchAll(/https?:\/\/[^\s)]+/gi)].map((match) => match[0]);
  const hashtags = [...text.matchAll(/(^|\s)#([a-z0-9_]+)/gi)].map((match) => match[2]!);
  return {
    channel: input.channel,
    title: `${input.title} · ${input.channel}`,
    text,
    links,
    media: [],
    hashtags,
  };
}

export function buildChannelPackages(input: {
  channels: string[];
  pressBody: string;
  title: string;
  topic: string;
  offerCta: string;
}): Array<ContentPackage & { validation: { ok: boolean; errors: string[] } }> {
  const out: Array<ContentPackage & { validation: { ok: boolean; errors: string[] } }> = [];
  for (const channel of input.channels) {
    const pkg = buildChannelPackage({ ...input, channel });
    if (!pkg) continue;
    out.push({ ...pkg, validation: validateContentPackage(pkg) });
  }
  return out;
}

export function packageForChannel(
  packages: ContentPackage[],
  channel: ContentPlatform,
): ContentPackage | undefined {
  return packages.find((pkg) => pkg.channel === channel);
}
