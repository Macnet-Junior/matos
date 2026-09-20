import Link from "next/link";
import { Badge } from "@matos/ui";
import { getSessionFlags } from "@/lib/owner";
import { loadMapPayload } from "@/lib/map-data";
import { SkillsPackageActions } from "@/components/SkillsPackageActions";
import { skillMapHref } from "@/lib/app-links";
import type { SkillStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

function tone(status: SkillStatus): "citron" | "muted" | "danger" {
  if (status === "authored") return "citron";
  if (status === "missing") return "danger";
  return "muted";
}

export default async function Page() {
  const { email, canEditSkills } = await getSessionFlags();
  const map = await loadMapPayload(email);
  const rows = map.departments.flatMap((d) =>
    d.skills.map((s) => ({ skill: s, department: d.name })),
  );

  return (
    <main className="flex flex-1 flex-col bg-matos-bg">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-matos-soft px-[22px] py-4">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Skills</h1>
          <p className="mt-1.5 max-w-xl text-xs text-matos-muted">
            {map.stats.skillCount} skills · {map.stats.authored} authored ·{" "}
            {map.stats.planned} planned · {map.stats.missing} missing
          </p>
        </div>
        <SkillsPackageActions enabled={canEditSkills} />
      </div>
      <div className="overflow-auto p-[22px]">
        <div className="overflow-hidden rounded-xl border border-matos-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-matos-elev text-matos-muted2">
              <tr>
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Department</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Gate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ skill, department }) => (
                <tr
                  key={skill.id}
                  className="border-t border-matos-soft bg-matos-panel"
                >
                  <td className="px-3 py-2 font-mono text-matos-citron">
                    <Link href={skillMapHref(skill.slug)}>{skill.slug}</Link>
                  </td>
                  <td className="px-3 py-2">{skill.title}</td>
                  <td className="px-3 py-2 text-matos-muted">{department}</td>
                  <td className="px-3 py-2">
                    <Badge tone={tone(skill.status)}>{skill.status}</Badge>
                  </td>
                  <td className="px-3 py-2 text-matos-muted">
                    {skill.reviewGate}
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
