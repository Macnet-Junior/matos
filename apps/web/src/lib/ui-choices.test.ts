import { describe, expect, it } from "vitest";
import { CONTENT_PLATFORMS } from "@/lib/content-platforms";
import {
  FEED_FILTERS,
  NAV_GROUPS,
  PINNED_NAV,
  collapsedSidebarChoices,
  deskChannelGroups,
  deskJobActionLayout,
  deskStageHeadline,
  moreFeedFilters,
  navItemActive,
  openNavGroupId,
  pinnedFeedFilters,
  visibleNavGroups,
} from "./ui-choices";

const EVERY_HREF = [
  "/home",
  "/brief",
  "/map",
  "/workbook",
  "/repository",
  "/workflows",
  "/skills",
  "/knowledge",
  "/activity",
  "/settings/channels",
  "/desk",
  "/calendar",
  "/inbox",
  "/ops",
  "/ops/feed",
  "/ops/presence",
  "/ops/usage",
  "/ops/billing",
  "/ops/content",
  "/ops/auto-response",
  "/support",
  "/support/chat",
  "/library",
  "/library/encoding-guide",
  "/library/desk",
];

describe("sidebar choice budget", () => {
  it("keeps every destination and shows the daily ones first", () => {
    const hrefs = [
      ...PINNED_NAV.map((item) => item.href),
      ...NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
    ];
    expect(hrefs.slice().sort()).toEqual(EVERY_HREF.slice().sort());
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(PINNED_NAV.map((item) => item.label)).toEqual([
      "Home",
      "Desk",
      "Inbox",
      "Calendar",
      "Workflows",
      "Skills",
      "Knowledge",
    ]);
  });

  it("collapses the owner sidebar well under the old 25-link list", () => {
    expect(visibleNavGroups(true).map((group) => group.id)).toEqual([
      "company",
      "records",
      "ops",
      "support",
      "library",
    ]);
    expect(visibleNavGroups(false).some((group) => group.id === "ops")).toBe(false);
    expect(collapsedSidebarChoices(true)).toBeLessThan(15);
    expect(collapsedSidebarChoices(false)).toBe(collapsedSidebarChoices(true) - 1);
  });

  it("opens the group that contains the current page", () => {
    expect(openNavGroupId("/ops/feed", true)).toBe("ops");
    expect(openNavGroupId("/ops", true)).toBe("ops");
    expect(openNavGroupId("/desk/job-1", true)).toBeNull();
    expect(openNavGroupId("/library/desk", true)).toBe("library");
    expect(openNavGroupId("/support/chat", true)).toBe("support");
    expect(navItemActive("/ops/feed", "/ops")).toBe(false);
    expect(navItemActive("/desk/abc", "/desk")).toBe(true);
  });
});

describe("feed and desk choice budgets", () => {
  it("pins three feed filters and keeps the other six", () => {
    expect(FEED_FILTERS).toHaveLength(9);
    expect(pinnedFeedFilters().map((filter) => filter.label)).toEqual([
      "All",
      "Usage",
      "Workflows",
    ]);
    expect(moreFeedFilters()).toHaveLength(6);
  });

  it("shows LinkedIn and X and collapses the other channels", () => {
    const { quick, more } = deskChannelGroups(CONTENT_PLATFORMS);
    expect(quick).toEqual(["linkedin", "x"]);
    expect(more).toHaveLength(CONTENT_PLATFORMS.length - 2);
    expect([...quick, ...more].slice().sort()).toEqual([...CONTENT_PLATFORMS].slice().sort());
  });

  it("gives a desk job one primary action", () => {
    expect(
      deskJobActionLayout({ canRun: true, canReview: false, hasArtifact: false, dirty: false }),
    ).toEqual({ primary: "run", secondary: null, more: [] });
    expect(
      deskJobActionLayout({ canRun: true, canReview: true, hasArtifact: true, dirty: false }),
    ).toEqual({
      primary: "approve",
      secondary: "request_changes",
      more: ["save", "regenerate"],
    });
    expect(
      deskJobActionLayout({ canRun: true, canReview: true, hasArtifact: true, dirty: true }),
    ).toEqual({
      primary: "save",
      secondary: "approve",
      more: ["regenerate", "request_changes"],
    });
    expect(
      deskJobActionLayout({ canRun: false, canReview: false, hasArtifact: true, dirty: false }).primary,
    ).toBeNull();
  });

  it("names the current desk step instead of six peer stages", () => {
    expect(deskStageHeadline("scout")).toBe("Scout · step 1 of 6");
    expect(deskStageHeadline("ghost")).toBe("Ghost · step 2 of 6");
    expect(deskStageHeadline("echo")).toBe("Echo · step 6 of 6");
    expect(deskStageHeadline("filed")).toBe("Filed");
  });
});
