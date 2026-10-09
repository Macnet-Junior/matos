import { CONTENT_PLATFORMS } from "@/lib/content-platforms";
import { DESK_STAGES, STAGE_LABELS, type DeskStage } from "@/lib/desk/stages";

export type NavItem = { href: string; label: string };

/** Destinations a solo operator opens most days. Always visible. */
export const PINNED_NAV: NavItem[] = [
  { href: "/home", label: "Home" },
  { href: "/desk", label: "Desk" },
  { href: "/inbox", label: "Inbox" },
  { href: "/calendar", label: "Calendar" },
  { href: "/workflows", label: "Workflows" },
  { href: "/skills", label: "Skills" },
  { href: "/knowledge", label: "Knowledge" },
];

export type NavGroup = {
  id: string;
  title: string;
  items: NavItem[];
  /** Owner and Operator only. Hidden for Author and Viewer. */
  requiresOps?: boolean;
};

/** Rare destinations. Closed until the operator opens the group. */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "company",
    title: "Company",
    items: [
      { href: "/brief", label: "Company brief" },
      { href: "/map", label: "Company map" },
      { href: "/workbook", label: "Workbook" },
      { href: "/repository", label: "Repository" },
    ],
  },
  {
    id: "records",
    title: "Records",
    items: [
      { href: "/activity", label: "Activity" },
      { href: "/settings/channels", label: "Channels" },
    ],
  },
  {
    id: "ops",
    title: "Ops",
    requiresOps: true,
    items: [
      { href: "/ops", label: "Ops home" },
      { href: "/ops/feed", label: "Feed" },
      { href: "/ops/presence", label: "Presence" },
      { href: "/ops/usage", label: "Usage" },
      { href: "/ops/billing", label: "Billing" },
      { href: "/ops/content", label: "Content" },
      { href: "/ops/auto-response", label: "Auto-response" },
    ],
  },
  {
    id: "support",
    title: "Support",
    items: [
      { href: "/support", label: "Tickets" },
      { href: "/support/chat", label: "Chatbot" },
    ],
  },
  {
    id: "library",
    title: "Library",
    items: [
      { href: "/library", label: "Library" },
      { href: "/library/encoding-guide", label: "Encoding guide" },
      { href: "/library/desk", label: "Desk archive" },
    ],
  },
];

export function visibleNavGroups(canViewOps: boolean): NavGroup[] {
  return NAV_GROUPS.filter((group) => !group.requiresOps || canViewOps);
}

/** Match the historical sidebar rule: Ops home is exact, everything else is a prefix. */
export function navItemActive(pathname: string, href: string): boolean {
  if (href === "/ops") return pathname === "/ops";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function openNavGroupId(
  pathname: string,
  canViewOps: boolean,
): string | null {
  const match = visibleNavGroups(canViewOps).find((group) =>
    group.items.some((item) => navItemActive(pathname, item.href)),
  );
  return match?.id ?? null;
}

/**
 * Controls in the sidebar before any group is opened: pinned links, one
 * summary per group, and the collapsed accent swatch.
 */
export function collapsedSidebarChoices(canViewOps: boolean): number {
  return PINNED_NAV.length + visibleNavGroups(canViewOps).length + 1;
}

export const FEED_FILTERS: { id: string; label: string }[] = [
  { id: "", label: "All" },
  { id: "auth", label: "Logins" },
  { id: "usage", label: "Usage" },
  { id: "workflow", label: "Workflows" },
  { id: "support", label: "Support" },
  { id: "auto-response", label: "Auto-response" },
  { id: "credit", label: "Credits" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "publish", label: "Publish" },
];

/** Filters kept on the bar. The rest stay in More. */
export const PINNED_FEED_FILTER_IDS = ["", "usage", "workflow"] as const;

export function pinnedFeedFilters() {
  return FEED_FILTERS.filter((filter) =>
    (PINNED_FEED_FILTER_IDS as readonly string[]).includes(filter.id),
  );
}

export function moreFeedFilters() {
  return FEED_FILTERS.filter(
    (filter) => !(PINNED_FEED_FILTER_IDS as readonly string[]).includes(filter.id),
  );
}

/** LinkedIn and X are the brief defaults. The other channels start collapsed. */
export const QUICK_DESK_CHANNELS = ["linkedin", "x"] as const;

export function deskChannelGroups(channels: readonly string[] = CONTENT_PLATFORMS) {
  const quick = channels.filter((channel) =>
    (QUICK_DESK_CHANNELS as readonly string[]).includes(channel),
  );
  const more = channels.filter(
    (channel) => !(QUICK_DESK_CHANNELS as readonly string[]).includes(channel),
  );
  return { quick, more };
}

export type DeskActionId = "run" | "save" | "approve" | "request_changes" | "regenerate";

/**
 * One primary action for the current desk job, at most one secondary, and the
 * rest behind More. Approving stays available while edits are unsaved; Save
 * becomes the primary so those edits are the obvious next step.
 */
export function deskJobActionLayout(input: {
  canRun: boolean;
  canReview: boolean;
  hasArtifact: boolean;
  dirty: boolean;
}): { primary: DeskActionId | null; secondary: DeskActionId | null; more: DeskActionId[] } {
  if (!input.hasArtifact) {
    return { primary: input.canRun ? "run" : null, secondary: null, more: [] };
  }
  const more: DeskActionId[] = [];
  if (input.canRun && !input.dirty) more.push("save");
  if (input.canRun) more.push("regenerate");
  if (input.canReview && input.dirty) more.push("request_changes");
  if (input.dirty && input.canRun) {
    return {
      primary: "save",
      secondary: input.canReview ? "approve" : null,
      more,
    };
  }
  if (input.canReview) {
    return { primary: "approve", secondary: "request_changes", more };
  }
  return { primary: null, secondary: null, more };
}

export function deskStageHeadline(stage: string): string {
  if (stage === "filed") return "Filed";
  const index = DESK_STAGES.indexOf(stage as DeskStage);
  if (index < 0) return stage;
  return `${STAGE_LABELS[stage as DeskStage]} · step ${index + 1} of ${DESK_STAGES.length}`;
}
