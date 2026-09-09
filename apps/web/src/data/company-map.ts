export type SkillStatus = "authored" | "planned" | "missing";

export interface Skill {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: SkillStatus;
  departmentId: string;
  owner: string;
  reviewGate: "Cold" | "Warm" | "Hot";
  instructions: string;
  knowledge: string[];
  evidence: string[];
}

export interface Department {
  id: string;
  name: string;
  summary: string;
  skillIds: string[];
}

export interface CompanyEntity {
  id: string;
  name: string;
  summary: string;
}

export const company: CompanyEntity = {
  id: "company-matos",
  name: "MatOS Agency",
  summary: "Root operating entity",
};

export const departments: Department[] = [
  {
    id: "dept-research",
    name: "Research Engine",
    summary: "Signals, ICP, competitive intel",
    skillIds: [],
  },
  {
    id: "dept-script",
    name: "Script & Story",
    summary: "Narratives, hooks, scripts",
    skillIds: [],
  },
  {
    id: "dept-content",
    name: "Content Studio",
    summary: "Calendars, assets, remixes",
    skillIds: ["skill-content-calendar"],
  },
  {
    id: "dept-calendar",
    name: "Calendar & Queue",
    summary: "Scheduling and release cadence",
    skillIds: [],
  },
  {
    id: "dept-publish",
    name: "Publish & Channels",
    summary: "Distribution and channel ops",
    skillIds: [],
  },
  {
    id: "dept-monetization",
    name: "Monetization",
    summary: "Offers, listings, revenue loops",
    skillIds: ["skill-etsy-listing-lab"],
  },
  {
    id: "dept-proof",
    name: "Proof & Loop",
    summary: "Evidence, review, feedback",
    skillIds: [],
  },
];

export const skills: Skill[] = [
  {
    id: "skill-content-calendar",
    slug: "content-calendar",
    title: "Content Calendar",
    description:
      "30-day content calendar with mix ratios per framework.",
    status: "authored",
    departmentId: "dept-content",
    owner: "Macnet Junior",
    reviewGate: "Warm",
    instructions:
      "Load brand voice and mix ratios. Draft a 30-day plan across proof, belief, offer, process, and community lanes. Flag missing sources before queue.",
    knowledge: [
      "knowledge/brand/voice.md",
      "knowledge/content/mix-ratios.md",
    ],
    evidence: ["No published runs yet — Phase 0 stub."],
  },
  {
    id: "skill-etsy-listing-lab",
    slug: "etsy-listing-lab",
    title: "Etsy Listing Lab",
    description:
      "Draft listing copy and tags from the offer brief. Publish stays human-gated.",
    status: "authored",
    departmentId: "dept-monetization",
    owner: "Macnet Junior",
    reviewGate: "Warm",
    instructions:
      "Collect offer brief and proof assets. Draft title, tags, and description. Queue for review — never auto-publish in Phase 0.",
    knowledge: ["knowledge/content/etsy-stub.md", "knowledge/brand/voice.md"],
    evidence: ["Etsy API deferred — stub only."],
  },
];

export function getDepartment(id: string): Department | undefined {
  return departments.find((d) => d.id === id);
}

export function getSkill(id: string): Skill | undefined {
  return skills.find((s) => s.id === id);
}

export function skillsForDepartment(departmentId: string): Skill[] {
  return skills.filter((s) => s.departmentId === departmentId);
}

export function authoredSkillCount(): number {
  return skills.filter((s) => s.status === "authored").length;
}
