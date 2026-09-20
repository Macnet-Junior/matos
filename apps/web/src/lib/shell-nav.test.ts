import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { knowledgeHref, skillMapHref } from "./app-links";
import { allShellNavHrefs } from "./shell-nav";

function collectShellPageRoutes(): Set<string> {
  const root = path.resolve(__dirname, "../app/(shell)");
  const routes = new Set<string>();

  function walk(dir: string, urlParts: string[]) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("(") && entry.name.endsWith(")")) {
          walk(path.join(dir, entry.name), urlParts);
          continue;
        }
        const segment = /^\[.+]$/.test(entry.name) ? ":param" : entry.name;
        walk(path.join(dir, entry.name), [...urlParts, segment]);
      } else if (entry.name === "page.tsx" || entry.name === "page.ts") {
        routes.add(`/${urlParts.join("/")}`);
      }
    }
  }

  walk(root, []);
  return routes;
}

describe("shell nav hrefs", () => {
  it("every sidebar href has a matching (shell) page", () => {
    const pages = collectShellPageRoutes();
    const missing = allShellNavHrefs.filter((href) => !pages.has(href));
    expect(missing).toEqual([]);
  });
});

describe("app links", () => {
  it("encodes knowledge and skill deep links", () => {
    expect(knowledgeHref("knowledge/brand/voice.md")).toBe(
      "/knowledge?path=knowledge%2Fbrand%2Fvoice.md",
    );
    expect(skillMapHref("hook-lab")).toBe("/map?skill=hook-lab");
  });
});
