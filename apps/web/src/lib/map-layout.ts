import type { DepartmentDTO, MapStats } from "./types";

export function computeStats(departments: DepartmentDTO[]): MapStats {
  const skills = departments.flatMap((d) => d.skills);
  return {
    departmentCount: departments.length,
    skillCount: skills.length,
    authored: skills.filter((s) => s.status === "authored").length,
    planned: skills.filter((s) => s.status === "planned").length,
    missing: skills.filter((s) => s.status === "missing").length,
  };
}

/** Deterministic layout: company center, departments around, skills outward. */
export function computeAutoArrange(
  departments: { id: string; skills: { id: string }[] }[],
) {
  const center = { x: 320, y: 280 };
  const radius = 260;
  const deptPositions: { id: string; posX: number; posY: number }[] = [];
  const skillPositions: { id: string; posX: number; posY: number }[] = [];

  const n = Math.max(departments.length, 1);
  departments.forEach((dept, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    deptPositions.push({
      id: dept.id,
      posX: Math.round(x),
      posY: Math.round(y),
    });

    dept.skills.forEach((skill, si) => {
      const outward = angle;
      const sx = x + Math.cos(outward) * 210;
      const sy =
        y +
        Math.sin(outward) * 210 +
        si * 88 -
        ((dept.skills.length - 1) * 88) / 2;
      skillPositions.push({
        id: skill.id,
        posX: Math.round(sx),
        posY: Math.round(sy),
      });
    });
  });

  return {
    company: { posX: center.x, posY: center.y },
    departments: deptPositions,
    skills: skillPositions,
  };
}
