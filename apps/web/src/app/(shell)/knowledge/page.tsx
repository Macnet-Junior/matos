import { prisma } from "@matos/db";
import { listKnowledgeMarkdown } from "@/lib/knowledge";
import { getSessionFlags } from "@/lib/owner";
import { KnowledgeBrowser } from "@/components/KnowledgeBrowser";
import { KnowledgeArchiveActions } from "@/components/KnowledgeArchiveActions";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { canEditSkills } = await getSessionFlags();
  const files = await listKnowledgeMarkdown();
  const links = await prisma.skillKnowledge.findMany({
    include: { skill: { select: { slug: true, title: true } } },
    orderBy: { path: "asc" },
  });

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-matos-soft px-[22px] py-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Knowledge</h1>
          <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
            Git-backed markdown under knowledge/ plus skill links from SQLite.
            Preview renders safely via react-markdown.
          </p>
        </div>
        <KnowledgeArchiveActions enabled={canEditSkills} />
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
