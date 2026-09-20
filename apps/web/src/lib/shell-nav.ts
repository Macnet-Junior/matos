export type NavItem = { href: string; label: string };

export const workspaceNav: NavItem[] = [
  { href: "/home", label: "Home" },
  { href: "/brief", label: "Company brief" },
  { href: "/map", label: "Company map" },
  { href: "/workbook", label: "Workbook" },
  { href: "/repository", label: "Repository" },
];

export const buildNav: NavItem[] = [
  { href: "/workflows", label: "Workflows" },
  { href: "/skills", label: "Skills" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/activity", label: "Activity" },
  { href: "/settings/channels", label: "Channels" },
];

export const opsNav: NavItem[] = [
  { href: "/ops", label: "Ops home" },
  { href: "/ops/feed", label: "Feed" },
  { href: "/ops/presence", label: "Presence" },
  { href: "/ops/usage", label: "Usage" },
  { href: "/ops/billing", label: "Billing" },
  { href: "/ops/auto-response", label: "Auto-response" },
];

export const supportNav: NavItem[] = [
  { href: "/support", label: "Tickets" },
  { href: "/support/chat", label: "Chatbot" },
];

export const deskNav: NavItem[] = [
  { href: "/desk", label: "Desk" },
  { href: "/calendar", label: "Calendar" },
  { href: "/inbox", label: "Inbox" },
];

export const libraryNav: NavItem[] = [
  { href: "/library", label: "Library" },
  { href: "/library/encoding-guide", label: "Encoding guide" },
  { href: "/library/desk", label: "Desk archive" },
];

export const allShellNavHrefs: string[] = [
  ...workspaceNav,
  ...buildNav,
  ...opsNav,
  ...supportNav,
  ...deskNav,
  ...libraryNav,
].map((item) => item.href);
