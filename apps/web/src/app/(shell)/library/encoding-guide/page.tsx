import Link from "next/link";
import { Badge } from "@matos/ui";
import { getSessionFlags } from "@/lib/owner";
import { loadMapPayload } from "@/lib/map-data";
import { evaluateSkillEncoding } from "@/lib/knowledge";
import { skillMapHref } from "@/lib/app-links";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { email } = await getSessionFlags();
  const map = await loadMapPayload(email);
  const results = map.departments.flatMap((d) =>
    d.skills.map((s) => evaluateSkillEncoding(s, d.name)),
  );
  const passing = results.filter((r) => r.pass).length;
  const failing = results.length - passing;

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="border-b border-matos-soft px-[22px] py-4">
        <h1 className="text-base font-semibold tracking-tight">
          Encoding guide
        </h1>
        <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
          Live checklist: purpose, steps, review gate, and ≥1 knowledge link.
          Authored status still requires instructions + existing knowledge
          files.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span>
            <b className="text-matos-citron">{passing}</b> pass
          </span>
          <span>
            <b className="text-matos-danger">{failing}</b> fail
          </span>
          <span className="text-matos-muted2">{results.length} skills</span>
        </div>
      </div>

      <div className="space-y-3 p-[22px]">
        <section className="rounded-xl border border-matos-border bg-matos-panel p-4 text-xs leading-relaxed text-matos-muted">
          <h2 className="text-sm font-semibold text-matos-text">Rules</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-4">
            <li>
              <b className="text-matos-text">Purpose</b> — one sentence on what
              the skill pays for.
            </li>
            <li>
              <b className="text-matos-text">Steps</b> — ordered, verifiable list
              (≥1).
            </li>
            <li>
              <b className="text-matos-text">Review gate</b> — Cold / Warm / Hot
              before external effects.
            </li>
            <li>
              <b className="text-matos-text">Knowledge</b> — link ≥1 markdown
              file under knowledge/.
            </li>
          </ol>
        </section>

        <div className="overflow-hidden rounded-xl border border-matos-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-matos-elev text-matos-muted2">
              <tr>
                <th className="px-3 py-2 font-medium">Skill</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Checklist</th>
                <th className="px-3 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr
                  key={row.skillId}
                  className="border-t border-matos-soft bg-matos-panel align-top"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={skillMapHref(row.slug)}
                      className="font-mono text-matos-citron hover:underline"
                    >
                      {row.slug}
                    </Link>
                    <div className="mt-0.5 text-matos-muted">{row.title}</div>
                  </td>
                  <td className="px-3 py-2.5 text-matos-muted">
                    {row.department}
                  </td>
                  <td className="px-3 py-2.5">
                    <ul className="space-y-1">
                      {row.checks.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-start gap-2 text-[11px]"
                        >
                          <span
                            className={
                              c.pass ? "text-matos-citron" : "text-matos-danger"
                            }
                            aria-hidden
                          >
                            {c.pass ? "✓" : "✗"}
                          </span>
                          <span>
                            <span className="text-matos-text">{c.label}</span>
                            <span className="text-matos-muted2">
                              {" "}
                              — {c.detail}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone={row.pass ? "citron" : "danger"}>
                      {row.pass ? "Pass" : "Fail"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
