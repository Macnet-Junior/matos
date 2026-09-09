import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@matos/db";
import { repoRoot } from "@/lib/knowledge";
import { KnowledgeBrowser } from "@/components/KnowledgeBrowser";

export const dynamic = "force-dynamic";

async function listMarkdown(dir: string, prefix = "knowledge"): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...(await listMarkdown(abs, rel)));
    } else if (entry.name.endsWith(".md")) {
      out.push(rel);
    }
  }
  return out.sort();
}

export default async function Page() {
  const root = path.join(repoRoot(), "knowledge");
  const files = await listMarkdown(root);
  const links = await prisma.skillKnowledge.findMany({
    include: { skill: { select: { slug: true, title: true } } },
    orderBy: { path: "asc" },
  });

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">Knowledge</h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Git-backed markdown under knowledge/ plus skill links from SQLite.
          Preview renders safely via react-markdown.
        </p>
      </div>
      <KnowledgeBrowser
        files={files}
        links={links.map((l) => ({
          id: l.id,
          path: l.path,
          skillSlug: l.skill.slug,
          skillTitle: l.skill.title,
        }))}
      />
    </main>
  );
}
