import fs from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActivityEntry } from "@/components/ActivityEntry";
import {
  activityActionLabel,
  activityHref,
} from "@/lib/activity-target";
import { PINNED_NAV, allNavGroups } from "@/lib/ui-choices";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => createElement("a", { href, className }, children),
}));

const SHELL = path.resolve(__dirname, "../app/(shell)");

const PLACEHOLDER =
  /Phase \d|later phase|coming soon|shell surface|content lands in a later|\bTODO\b|until Phase/i;

function pageFile(href: string): string {
  return path.join(SHELL, href.replace(/^\//, ""), "page.tsx");
}

const sidebarHrefs = [
  ...PINNED_NAV.map((item) => item.href),
  ...allNavGroups(true).flatMap((group) => group.items.map((item) => item.href)),
];

describe("sidebar links", () => {
  it("hides empty shells and keeps the remaining order", () => {
    expect(sidebarHrefs).not.toContain("/repository");
    expect(sidebarHrefs).not.toContain("/brief");
    expect(sidebarHrefs).not.toContain("/workbook");
    expect(PINNED_NAV.map((item) => item.href)).toEqual([
      "/home",
      "/desk",
      "/calendar",
      "/inbox",
    ]);
  });

  it("every sidebar link resolves to a real, non-placeholder page", () => {
    expect(sidebarHrefs.length).toBeGreaterThan(0);
    for (const href of sidebarHrefs) {
      const file = pageFile(href);
      expect(fs.existsSync(file), href).toBe(true);
      const text = fs.readFileSync(file, "utf8");
      expect(text, href).not.toMatch(PLACEHOLDER);
      expect(text, href).not.toMatch(
        /export default (?:async )?function \w+\([^)]*\) \{\s*redirect\(/,
      );
    }
  });

  it("keeps the empty shell routes harmless by sending them to the map", () => {
    for (const href of ["/repository", "/brief", "/workbook"]) {
      const text = fs.readFileSync(pageFile(href), "utf8");
      expect(text).toContain('redirect("/map")');
      expect(text).not.toMatch(PLACEHOLDER);
    }
  });
});

describe("activity targets", () => {
  it("opens the desk job, skill, workflow run, knowledge doc, or source", () => {
    expect(
      activityHref({
        action: "desk.stage.approve",
        entityType: "desk_job",
        entityId: "job-1",
      }),
    ).toBe("/desk/job-1");
    expect(
      activityHref(
        { action: "skill.update", entityType: "skill", entityId: "sk-1" },
        { skillSlug: "hook-lab" },
      ),
    ).toBe("/map?skill=hook-lab");
    expect(
      activityHref({
        action: "workflow.run",
        entityType: "workflow_run",
        entityId: "run-1",
      }),
    ).toBe("/workflows/runs/run-1");
    expect(
      activityHref({
        action: "knowledge.import",
        entityType: "knowledge",
        entityId: "archive",
        payload: { written: ["knowledge/brand/voice.md"] },
      }),
    ).toBe(`/knowledge?path=${encodeURIComponent("knowledge/brand/voice.md")}`);
    expect(
      activityHref(
        {
          action: "desk.source.ingested",
          entityType: "desk_source",
          entityId: "src-1",
        },
        { jobId: "job-9", exists: true },
      ),
    ).toBe("/desk/job-9");
  });

  it("leaves events with no real target as plain text targets", () => {
    expect(
      activityHref(
        {
          action: "desk.source.ingested",
          entityType: "desk_source",
          entityId: "src-1",
        },
        { jobId: null, exists: false },
      ),
    ).toBeNull();
    expect(
      activityHref({
        action: "workflow.delete",
        entityType: "workflow",
        entityId: "wf-1",
      }),
    ).toBeNull();
    expect(
      activityHref({ action: "mystery.thing", entityType: "nope", entityId: "x" }),
    ).toBeNull();
    expect(activityHref({
      action: "desk.job.approve",
      entityType: "desk_job",
      entityId: "gone",
    }, { exists: false })).toBeNull();
  });

  it("replaces raw action codes with plain words", () => {
    expect(activityActionLabel("desk.job.approve")).toBe("Desk job approved");
    expect(activityActionLabel("desk.stage.approve")).toBe("Desk stage approved");
    expect(activityActionLabel("usage.ai_credit")).toBe("Usage recorded");
    expect(activityActionLabel("desk.job.approve")).not.toContain(".");
  });
});

describe("recent activity rows", () => {
  it("renders a link when the event has a target", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityEntry, {
        summary: "Approved Ghost on the brief",
        actionLabel: "Desk stage approved",
        href: "/desk/job-1",
      }),
    );
    expect(html).toContain('href="/desk/job-1"');
    expect(html).toContain("Approved Ghost on the brief");
    expect(html).toContain("Desk stage approved");
    expect(html).not.toContain("desk.");
  });

  it("does not look clickable when the event has no target", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityEntry, {
        summary: "Noted",
        actionLabel: activityActionLabel("desk.job.approve"),
        href: null,
      }),
    );
    expect(html).not.toContain("<a");
    expect(html).toContain("Desk job approved");
    expect(html).not.toContain("desk.job.approve");
    expect(html).not.toContain("hover:border-matos-citron");
  });
});
