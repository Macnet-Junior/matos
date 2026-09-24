"use client";

import dynamic from "next/dynamic";

const SkillStudio = dynamic(
  () => import("@/components/skill-studio").then((mod) => mod.SkillStudio),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-full place-items-center text-sm text-muted-foreground">
        Opening your drafts…
      </main>
    ),
  },
);

export default function Home() {
  return <SkillStudio />;
}
