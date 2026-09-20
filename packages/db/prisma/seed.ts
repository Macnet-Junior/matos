import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedSkill = {
  slug: string;
  title: string;
  description: string;
  status: "authored" | "planned" | "missing";
  reviewGate?: "Cold" | "Warm" | "Hot";
  purpose?: string;
  instructions?: string;
  steps?: string[];
  evidence?: { url: string; label: string }[];
  knowledge?: { path: string; title?: string }[];
};

type SeedDept = {
  slug: string;
  name: string;
  summary: string;
  expanded?: boolean;
  posX: number;
  posY: number;
  skills: SeedSkill[];
};

const DEPARTMENTS: SeedDept[] = [
  {
    slug: "research",
    name: "Research Engine",
    summary: "Signals, ICP, competitive intel",
    posX: 40,
    posY: 40,
    skills: [
      {
        slug: "trend-radar",
        title: "Trend Radar",
        description: "Ranked niche angles from X/TikTok/YouTube/search.",
        status: "planned",
        purpose: "Decide what is worth making this week.",
        knowledge: [
          { path: "knowledge/research/notes.md", title: "Research notes" },
        ],
      },
      {
        slug: "competitor-gap",
        title: "Competitor Gap",
        description: "What peer accounts posted — and what is missing.",
        status: "planned",
      },
      {
        slug: "voice-miner",
        title: "Voice Miner",
        description: "Learn brand phrasing from Git knowledge + winners.",
        status: "planned",
        purpose: "Extract reusable phrasing from brand voice and winning posts.",
        knowledge: [
          { path: "knowledge/brand/voice.md", title: "Brand voice" },
          { path: "knowledge/research/notes.md", title: "Research notes" },
        ],
      },
      {
        slug: "offer-fit",
        title: "Offer Fit",
        description: "Map an angle to a product or lead magnet you sell.",
        status: "planned",
        purpose: "Connect a research angle to a concrete offer rung.",
        knowledge: [
          { path: "knowledge/monetization/offers.md", title: "Offers" },
          { path: "knowledge/research/notes.md", title: "Research notes" },
        ],
      },
    ],
  },
  {
    slug: "script",
    name: "Script & Story",
    summary: "Narratives, hooks, scripts",
    posX: 40,
    posY: 220,
    expanded: true,
    skills: [
      {
        slug: "hook-lab",
        title: "Hook Lab",
        description: "8–12 hooks for one angle; beginner vs expert variants.",
        status: "authored",
        reviewGate: "Warm",
        purpose: "Produce scarce opening lines that earn the scroll-stop.",
        instructions:
          "Take one approved angle. Draft 8–12 hooks: half beginner-clear, half expert-dense. Score each for clarity, tension, and offer fit. Keep brand voice from knowledge/brand/voice.md.",
        steps: [
          "Load brand voice and the approved angle brief",
          "Draft beginner hooks (plain language, concrete stakes)",
          "Draft expert hooks (pattern interrupt, insider framing)",
          "Score and shortlist top 3 for production",
          "Queue Warm review before calendar placement",
        ],
        evidence: [
          {
            url: "knowledge/brand/voice.md",
            label: "Brand voice source",
          },
        ],
        knowledge: [{ path: "knowledge/brand/voice.md", title: "Brand voice" }],
      },
      {
        slug: "short-script",
        title: "Short Script",
        description: "15–45s reel/TikTok/Shorts: visual + VO + on-screen text.",
        status: "authored",
        reviewGate: "Warm",
        purpose: "Turn a winning hook into a shootable short-form script.",
        instructions:
          "Pick the winning hook. Write a 15–45s script with visual beats, VO, and on-screen text. End on a clear CTA aligned to the offer ladder. Flag missing proof assets before Warm review.",
        steps: [
          "Lock hook and platform length target",
          "Outline visual beats (0–3s, 3–15s, close)",
          "Write VO and on-screen text in parallel",
          "Attach CTA and knowledge links",
          "Submit for Warm review",
        ],
        evidence: [
          {
            url: "knowledge/brand/voice.md",
            label: "Brand voice source",
          },
        ],
        knowledge: [
          { path: "knowledge/brand/voice.md", title: "Brand voice" },
          { path: "knowledge/content/mix-ratios.md", title: "Mix ratios" },
        ],
      },
      {
        slug: "long-script",
        title: "Long Script",
        description: "YouTube / podcast / VSL outline + A-roll.",
        status: "planned",
      },
      {
        slug: "caption-pack",
        title: "Caption Pack",
        description: "Native captions per platform — not one paste everywhere.",
        status: "planned",
      },
      {
        slug: "thread-builder",
        title: "Thread Builder",
        description: "X/LinkedIn thread from a script or blog.",
        status: "planned",
      },
    ],
  },
  {
    slug: "content",
    name: "Content Studio",
    summary: "Calendars, assets, remixes",
    posX: 520,
    posY: 20,
    skills: [
      {
        slug: "brief-card",
        title: "Brief Card",
        description: "One-pager: hook, visual, CTA, offer, platform specs.",
        status: "planned",
      },
      {
        slug: "asset-pack",
        title: "Asset Pack",
        description: "Checklist + export sizes + caption variants.",
        status: "planned",
      },
      {
        slug: "repurpose-engine",
        title: "Repurpose Engine",
        description: "One long asset → 20–40 native posts.",
        status: "planned",
      },
      {
        slug: "carousel-builder",
        title: "Carousel Builder",
        description: "Slide outline + copy for IG/LinkedIn carousels.",
        status: "planned",
      },
      {
        slug: "qa-gate",
        title: "QA Gate",
        description: "Brand-voice + claim + CTA + link check before schedule.",
        status: "planned",
      },
    ],
  },
  {
    slug: "calendar",
    name: "Calendar & Queue",
    summary: "Scheduling and release cadence",
    posX: 40,
    posY: 400,
    expanded: true,
    skills: [
      {
        slug: "content-calendar",
        title: "Content Calendar",
        description: "30-day mix: education / proof / offer / community.",
        status: "authored",
        reviewGate: "Warm",
        purpose: "Plan a month of posts with intentional mix ratios.",
        instructions:
          "Load brand voice and mix ratios. Draft a 30-day plan across proof, belief, offer, process, and community lanes. Flag missing sources before queue.",
        steps: [
          "Load mix ratios and brand constraints",
          "Block themes by week",
          "Assign lane mix (education / proof / offer / community)",
          "Link skills and knowledge sources",
          "Queue Warm review before publish handoff",
        ],
        evidence: [
          {
            url: "knowledge/content/mix-ratios.md",
            label: "Mix ratios reference",
          },
        ],
        knowledge: [
          { path: "knowledge/brand/voice.md", title: "Brand voice" },
          { path: "knowledge/content/mix-ratios.md", title: "Mix ratios" },
        ],
      },
      {
        slug: "slot-optimizer",
        title: "Slot Optimizer",
        description: "Suggest times per channel from past engagement.",
        status: "planned",
      },
      {
        slug: "approval-board",
        title: "Approval Board",
        description: "Client or owner taps Approve / Change.",
        status: "planned",
      },
      {
        slug: "batch-queue",
        title: "Batch Queue",
        description: "Fill a week; draft → warm → approved → scheduled.",
        status: "planned",
      },
    ],
  },
  {
    slug: "publish",
    name: "Publish & Channels",
    summary: "Distribution and channel ops",
    posX: 520,
    posY: 420,
    skills: [
      {
        slug: "channel-connect",
        title: "Channel Connect",
        description: "Connect accounts via publishing partner OAuth.",
        status: "planned",
      },
      {
        slug: "native-adapt",
        title: "Native Adapt",
        description: "Final per-platform payload (length, hashtags, cover).",
        status: "planned",
      },
      {
        slug: "scheduler",
        title: "Scheduler",
        description: "Fire at booked slot; retry; log receipt.",
        status: "planned",
      },
      {
        slug: "manual-handoff",
        title: "Manual Handoff",
        description: "Download pack when an API cannot post.",
        status: "planned",
      },
      {
        slug: "whatsapp-drop",
        title: "WhatsApp Drop",
        description: "Approved prompt → gated group drop only.",
        status: "planned",
        purpose: "Deferred: gated group drop stays human-approved; no Cloud auto-send.",
      },
      {
        slug: "etsy-publish",
        title: "Etsy Publish",
        description: "Push listing drafts — live API deferred.",
        status: "planned",
        purpose: "Deferred: listing drafts only; live Etsy publish is not wired.",
      },
    ],
  },
  {
    slug: "monetization",
    name: "Monetization",
    summary: "Offers, listings, revenue loops",
    posX: 520,
    posY: 220,
    expanded: true,
    skills: [
      {
        slug: "offer-ladder",
        title: "Offer Ladder",
        description: "Free → low ticket → high ticket mapped to posts.",
        status: "planned",
        purpose: "Keep every CTA on a named rung of the ladder.",
        knowledge: [
          { path: "knowledge/monetization/offers.md", title: "Offers" },
        ],
      },
      {
        slug: "cta-router",
        title: "CTA Router",
        description: "Which link/CTA this post gets.",
        status: "planned",
      },
      {
        slug: "lead-magnet",
        title: "Lead Magnet",
        description: "Pair a research angle with an existing magnet.",
        status: "planned",
      },
      {
        slug: "revenue-board",
        title: "Revenue Board",
        description: "Posts → clicks → leads → cash.",
        status: "planned",
      },
      {
        slug: "etsy-shop",
        title: "Etsy Shop",
        description: "Connect shop; sync listings as sellable offers.",
        status: "planned",
      },
      {
        slug: "etsy-listing-lab",
        title: "Etsy Listing Lab",
        description:
          "Draft listing copy and tags from the offer brief. Publish stays human-gated.",
        status: "authored",
        reviewGate: "Warm",
        purpose: "Turn a winning post/script into an Etsy listing brief.",
        instructions:
          "Collect offer brief and proof assets. Draft title, tags, and description. Queue for review — never auto-publish. Live Etsy API is deferred.",
        steps: [
          "Collect offer brief and proof assets",
          "Draft title, tags, and description from brand voice",
          "Cross-check against etsy-stub knowledge",
          "Queue Warm review — no live publish",
        ],
        evidence: [
          {
            url: "knowledge/content/etsy-listing-checklist.md",
            label: "Etsy listing checklist",
          },
        ],
        knowledge: [
          {
            path: "knowledge/content/etsy-listing-checklist.md",
            title: "Etsy listing checklist",
          },
          { path: "knowledge/content/etsy-stub.md", title: "Etsy stub" },
          { path: "knowledge/brand/voice.md", title: "Brand voice" },
          { path: "knowledge/monetization/offers.md", title: "Offers" },
        ],
      },
    ],
  },
  {
    slug: "proof",
    name: "Proof & Loop",
    summary: "Evidence, review, feedback",
    posX: 280,
    posY: 480,
    skills: [
      {
        slug: "post-score",
        title: "Post Score",
        description: "What hit (watch time, saves, replies) per platform.",
        status: "planned",
      },
      {
        slug: "winner-replay",
        title: "Winner Replay",
        description: "Feed winning hooks back into hook-lab + Git knowledge.",
        status: "planned",
      },
      {
        slug: "client-report",
        title: "Client Report",
        description: "One-page weekly PDF/link for a brand.",
        status: "planned",
      },
    ],
  },
];

async function main() {
  await prisma.runStep.deleteMany();
  await prisma.workflowRun.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.activityEvent.deleteMany();
  await prisma.skillKnowledge.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.department.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.company.deleteMany();

  const company = await prisma.company.create({
    data: {
      id: "company-matos",
      name: "MatOS Agency",
      summary: "Root operating entity",
      posX: 280,
      posY: 220,
    },
  });

  for (let i = 0; i < DEPARTMENTS.length; i++) {
    const d = DEPARTMENTS[i];
    const dept = await prisma.department.create({
      data: {
        id: `dept-${d.slug}`,
        companyId: company.id,
        slug: d.slug,
        name: d.name,
        summary: d.summary,
        sortOrder: i,
        posX: d.posX,
        posY: d.posY,
        expanded: d.expanded ?? false,
      },
    });

    for (const s of d.skills) {
      const skill = await prisma.skill.create({
        data: {
          id: `skill-${s.slug}`,
          departmentId: dept.id,
          slug: s.slug,
          title: s.title,
          description: s.description,
          status: s.status,
          owner: "Macnet Junior",
          reviewGate: s.reviewGate ?? "Warm",
          purpose: s.purpose ?? "",
          instructions: s.instructions ?? "",
          stepsJson: JSON.stringify(s.steps ?? []),
          evidenceJson: JSON.stringify(s.evidence ?? []),
        },
      });

      if (s.knowledge?.length) {
        for (let k = 0; k < s.knowledge.length; k++) {
          const kn = s.knowledge[k];
          await prisma.skillKnowledge.create({
            data: {
              skillId: skill.id,
              path: kn.path,
              title: kn.title,
              sortOrder: k,
            },
          });
        }
      }
    }
  }

  // --- Phase 3 workflows ---
  await prisma.runStep.deleteMany();
  await prisma.workflowRun.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.workflow.deleteMany();

  const skillBySlug = async (slug: string) => {
    const s = await prisma.skill.findFirst({ where: { slug } });
    if (!s) throw new Error(`Missing skill for workflow seed: ${slug}`);
    return s;
  };

  const researchToCalendar = await prisma.workflow.create({
    data: {
      id: "wf-research-to-calendar",
      slug: "research-to-calendar",
      name: "Research → Hook → Caption → Calendar",
      description:
        "Dry-run chain from niche research through hooks and captions into a content calendar. Publish stays gated.",
      gateState: "draft",
    },
  });

  const r2cSlugs = ["trend-radar", "hook-lab", "caption-pack", "content-calendar"] as const;
  for (let i = 0; i < r2cSlugs.length; i++) {
    const skill = await skillBySlug(r2cSlugs[i]);
    await prisma.workflowStep.create({
      data: {
        id: `wfs-r2c-${i}`,
        workflowId: researchToCalendar.id,
        skillId: skill.id,
        sortOrder: i,
        label: skill.title,
      },
    });
  }

  const hookToScript = await prisma.workflow.create({
    data: {
      id: "wf-hook-to-script",
      slug: "hook-to-script-calendar",
      name: "Hook → Short Script → Calendar",
      description:
        "Turn a winning hook into a short script and place it on the calendar. Dry-run only.",
      gateState: "draft",
    },
  });

  const h2sSlugs = ["hook-lab", "short-script", "content-calendar"] as const;
  for (let i = 0; i < h2sSlugs.length; i++) {
    const skill = await skillBySlug(h2sSlugs[i]);
    await prisma.workflowStep.create({
      data: {
        id: `wfs-h2s-${i}`,
        workflowId: hookToScript.id,
        skillId: skill.id,
        sortOrder: i,
        label: skill.title,
      },
    });
  }

  // Phase 4 RBAC — demo role assignments (OWNER_EMAIL always resolves as Owner)
  const roleSeeds: { email: string; role: string; note: string }[] = [
    {
      email: "macnet@matos.local",
      role: "Owner",
      note: "Default owner (also via OWNER_EMAIL)",
    },
    {
      email: "operator@matos.local",
      role: "Operator",
      note: "Dev login: run + approve workflows",
    },
    {
      email: "author@matos.local",
      role: "Author",
      note: "Dev login: edit skills",
    },
    {
      email: "viewer@matos.local",
      role: "Viewer",
      note: "Dev login: read-only",
    },
  ];
  for (const row of roleSeeds) {
    await prisma.userRole.upsert({
      where: { email: row.email },
      create: row,
      update: { role: row.role, note: row.note },
    });
  }

  // --- Phase 5 ops & support sample data ---
  await prisma.autoResponseAttempt.deleteMany();
  await prisma.autoResponseRule.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatThread.deleteMany();
  await prisma.supportMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.usageEvent.deleteMany();
  await prisma.creditLedger.deleteMany();
  await prisma.userPresence.deleteMany();

  await prisma.creditLedger.create({
    data: {
      id: "credit-seed-grant",
      userId: "workspace",
      entryType: "grant",
      units: 1000,
      balanceAfter: 1000,
      note: "Phase 5 seed credit grant",
      actorEmail: "system@matos.local",
    },
  });

  const usageSeeds: { userId: string; kind: string; units: number }[] = [
    { userId: "macnet@matos.local", kind: "ai_credit", units: 12 },
    { userId: "macnet@matos.local", kind: "late_post", units: 3 },
    { userId: "operator@matos.local", kind: "etsy_call", units: 5 },
    { userId: "operator@matos.local", kind: "whatsapp_send", units: 1 },
    { userId: "author@matos.local", kind: "api_hit", units: 40 },
    { userId: "viewer@matos.local", kind: "api_hit", units: 8 },
  ];
  for (const u of usageSeeds) {
    await prisma.usageEvent.create({
      data: {
        userId: u.userId,
        kind: u.kind,
        units: u.units,
        metaJson: JSON.stringify({ seed: true }),
      },
    });
  }

  await prisma.creditLedger.create({
    data: {
      userId: "workspace",
      entryType: "consume",
      units: -25,
      balanceAfter: 975,
      note: "Seed consumption (AI + Late stub)",
      actorEmail: "system@matos.local",
    },
  });

  const approvedRule = await prisma.autoResponseRule.create({
    data: {
      id: "ar-hours",
      name: "Office hours reply",
      triggerKeyword: "hours",
      channel: "support",
      template:
        "Thanks for writing — MatOS support hours are weekdays 9–5 ET. An Owner will follow up on tickets.",
      enabled: true,
      reviewGate: "approved",
      approvedBy: "macnet@matos.local",
      approvedAt: new Date(),
    },
  });
  await prisma.autoResponseRule.create({
    data: {
      id: "ar-pending",
      name: "Welcome (pending gate)",
      triggerKeyword: "hello",
      channel: "whatsapp",
      template: "Welcome — this rule stays disabled until approved.",
      enabled: false,
      reviewGate: "pending",
    },
  });
  await prisma.autoResponseAttempt.create({
    data: {
      ruleId: approvedRule.id,
      status: "sent_sim",
      detail: "Seed simulated auto-reply",
      actorEmail: "system@matos.local",
    },
  });

  const ticket = await prisma.supportTicket.create({
    data: {
      id: "ticket-seed-1",
      subject: "How do I connect Late.dev?",
      body: "I want to schedule posts but Channels shows Disconnected.",
      status: "open",
      priority: "normal",
      requesterEmail: "viewer@matos.local",
      assigneeEmail: "operator@matos.local",
      messages: {
        create: {
          authorEmail: "viewer@matos.local",
          body: "I want to schedule posts but Channels shows Disconnected.",
          kind: "comment",
        },
      },
    },
  });

  const thread = await prisma.chatThread.create({
    data: {
      id: "chat-seed-1",
      userEmail: "viewer@matos.local",
      title: "FAQ help",
      messages: {
        create: [
          {
            role: "user",
            body: "How do credits work?",
            metaJson: "{}",
          },
          {
            role: "assistant",
            body: "Credits are stub meters — Stripe is not live. See knowledge/support/billing-credits.md.",
            metaJson: JSON.stringify({ kind: "answer", usedLlm: false }),
          },
        ],
      },
    },
  });

  await prisma.userPresence.createMany({
    data: [
      {
        email: "macnet@matos.local",
        role: "Owner",
        lastSeenAt: new Date(),
        currentPath: "/ops/feed",
      },
      {
        email: "operator@matos.local",
        role: "Operator",
        lastSeenAt: new Date(Date.now() - 60_000),
        currentPath: "/workflows",
      },
    ],
  });


  // --- Phase 5.5 Relay Desk sample jobs ---
  await prisma.deskInboxItem.deleteMany();
  await prisma.deskCalendarItem.deleteMany();
  await prisma.deskStageArtifact.deleteMany();
  await prisma.deskJob.deleteMany();

  const dueSoon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const dueLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const deskJob1 = await prisma.deskJob.create({
    data: {
      id: "desk-job-seed-1",
      title: "ICP pain → offer ladder post",
      topic: "Why solo operators drown in content ops",
      audience: "Founder-operators building a one-person media company",
      offerCta: "Book a MatOS walkthrough / start with the Company Map",
      channelsJson: JSON.stringify(["x", "linkedin", "newsletter"]),
      dueAt: dueSoon,
      stage: "ghost",
      status: "awaiting_approval",
      createdBy: "author@matos.local",
      artifacts: {
        create: [
          {
            id: "desk-art-scout-1",
            stage: "scout",
            title: "Scout notes",
            body: `## Research notes

- Solo operators spend 6–10h/week on tooling glue.
- Pain: briefs never become scheduled packs.
- Angle: Desk as a newsroom with human gates.
- Sources: internal brand voice + offer ladder.`,
            reviewState: "approved",
            reviewedBy: "operator@matos.local",
            reviewedAt: new Date(),
          },
          {
            id: "desk-art-ghost-1",
            stage: "ghost",
            title: "Ghost draft",
            body: `## Draft

Hook: Your content calendar is a graveyard of almost-ships.

Body: MatOS Desk runs Scout → Ghost → Editor → Press → Clock → Echo with an approve gate at every stage.

CTA: Open Desk and file your first brief.`,
            reviewState: "ready",
          },
        ],
      },
    },
  });

  const deskJob2 = await prisma.deskJob.create({
    data: {
      id: "desk-job-seed-2",
      title: "Warm review ritual explainer",
      topic: "Warm review beats spray-and-pray publishing",
      audience: "Operators who approve content before it ships",
      offerCta: "Use Warm gate on Workflows + Desk Press packs",
      channelsJson: JSON.stringify(["linkedin", "blog"]),
      dueAt: dueLater,
      stage: "scout",
      status: "draft",
      createdBy: "macnet@matos.local",
    },
  });


  await prisma.activityEvent.create({
    data: {
      action: "seed",
      entityType: "company",
      entityId: company.id,
      summary:
        "Seeded MatOS Agency with map, workflows, RBAC, integrations stubs, Phase 5 ops/support, and Phase 5.5 Desk",
      actorEmail: "system@matos.local",
      payloadJson: JSON.stringify({
        phase: 5.5,
        workflows: [researchToCalendar.slug, hookToScript.slug],
        roles: roleSeeds.map((r) => r.email),
        ticketId: ticket.id,
        chatThreadId: thread.id,
        autoResponse: approvedRule.id,
      }),
    },
  });

  const counts = {
    departments: await prisma.department.count(),
    skills: await prisma.skill.count(),
    authored: await prisma.skill.count({ where: { status: "authored" } }),
    workflows: await prisma.workflow.count(),
    workflowSteps: await prisma.workflowStep.count(),
    roles: await prisma.userRole.count(),
    usageEvents: await prisma.usageEvent.count(),
    tickets: await prisma.supportTicket.count(),
    autoRules: await prisma.autoResponseRule.count(),
    deskJobs: await prisma.deskJob.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
