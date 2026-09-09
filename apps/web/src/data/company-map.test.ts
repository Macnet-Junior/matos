import { describe, expect, it } from "vitest";
import {
  authoredSkillCount,
  company,
  departments,
  getSkill,
  skills,
} from "./company-map";

describe("company map seed", () => {
  it("has seven departments and MatOS Agency center", () => {
    expect(company.name).toBe("MatOS Agency");
    expect(departments).toHaveLength(7);
  });

  it("seeds authored skills content-calendar and etsy-listing-lab", () => {
    const calendar = skills.find((s) => s.slug === "content-calendar");
    const etsy = skills.find((s) => s.slug === "etsy-listing-lab");
    expect(calendar?.status).toBe("authored");
    expect(etsy?.status).toBe("authored");
    expect(getSkill("skill-content-calendar")?.departmentId).toBe(
      "dept-content",
    );
    expect(getSkill("skill-etsy-listing-lab")?.departmentId).toBe(
      "dept-monetization",
    );
    expect(authoredSkillCount()).toBe(2);
  });
});
