import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@matos/db";
import { repoRoot } from "@/lib/knowledge";

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
        </p>
      </div>
      <div className="grid gap-4 p-[22px] lg:grid-cols-2">
        <section className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-xs font-semibold tracking-tight text-matos-text">
            Files
          </h2>
          <ul className="mt-3 space-y-2">
            {files.map((f) => (
              <li
                key={f}
                className="rounded-lg border border-matos-soft bg-matos-elev px-2.5 py-2 font-mono text-[11px] text-matos-muted"
              >
                {f}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-matos-border bg-matos-panel p-4">
          <h2 className="text-xs font-semibold tracking-tight text-matos-text">
            Skill links
          </h2>
          <ul className="mt-3 space-y-2">
            {links.map((l) => (
              <li
                key={l.id}
                className="rounded-lg border border-matos-soft bg-matos-elev px-2.5 py-2 text-[11px]"
              >
                <div className="font-mono text-matos-citron">{l.path}</div>
                <div className="mt-1 text-matos-muted">
                  {l.skill.slug} · {l.skill.title}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
