"use client";

import { useState } from "react";
import { Button } from "@matos/ui";
import {
  authoredSkillCount,
  departments,
  getSkill,
} from "@/data/company-map";
import { CompanyMap } from "./CompanyMap";
import { DetailPanel, type Selection } from "./DetailPanel";

export function MapShell() {
  const [selection, setSelection] = useState<Selection>(() => {
    const skill = getSkill("skill-content-calendar");
    return skill ? { kind: "skill", skill } : null;
  });

  return (
    <div className="flex min-h-0 flex-1">
      <main className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(214,243,31,0.04),transparent_60%),#0b0c0e]">
        <div className="flex items-center justify-between border-b border-matos-soft px-[22px] py-4">
          <div>
            <h1 className="text-base font-semibold tracking-tight">
              Company map
            </h1>
            <div className="mt-1.5 flex gap-[18px] text-xs text-matos-muted">
              <span>
                <b className="font-semibold text-matos-text">
                  {departments.length}
                </b>{" "}
                Departments
              </span>
              <span>
                <b className="font-semibold text-matos-citron">
                  {authoredSkillCount()}
                </b>{" "}
                Authored skills
              </span>
              <span>
                <b className="font-semibold text-matos-text">0</b> Planned
              </span>
              <span>
                <b className="font-semibold text-matos-text">0</b> Missing
                sources
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary">Auto arrange</Button>
            <Button variant="primary">New skill</Button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <CompanyMap selection={selection} onSelect={setSelection} />
        </div>
      </main>
      <DetailPanel selection={selection} />
    </div>
  );
}
