import { describe, expect, it } from "vitest";
import { prisma } from "@matos/db";
import {
  canAdvanceGate,
  executeDryRun,
  advanceRunGate,
  listWorkflows,
  getRun,
} from "./workflows";

describe("workflow dry-run engine (db)", () => {
  it("lists seeded workflows", async () => {
    const workflows = await listWorkflows();
    expect(workflows.length).toBeGreaterThanOrEqual(2);
    const slugs = workflows.map((w) => w.slug);
    expect(slugs).toContain("research-to-calendar");
    expect(slugs).toContain("hook-to-script-calendar");
  });

  it("executes a dry-run and writes step artifacts", async () => {
    const wf = await prisma.workflow.findUniqueOrThrow({
      where: { slug: "hook-to-script-calendar" },
    });
    const run = await executeDryRun({
      workflowId: wf.id,
      actorEmail: "macnet@matos.local",
    });
    expect(run.dryRun).toBe(true);
    expect(run.steps.length).toBe(3);
    expect(run.steps.every((s) => s.status === "completed")).toBe(true);
    expect(run.steps[0].artifact.kind).toBe("dry-run-artifact");
    expect(run.gateState).toBe("draft");

    const loaded = await getRun(run.id);
    expect(loaded?.id).toBe(run.id);
  });

  it("blocks publish without approved on gate advance", async () => {
    expect(canAdvanceGate("draft", "published").ok).toBe(false);
    const wf = await prisma.workflow.findUniqueOrThrow({
      where: { slug: "research-to-calendar" },
    });
    const run = await executeDryRun({ workflowId: wf.id });
    await expect(
      advanceRunGate({ runId: run.id, to: "published" }),
    ).rejects.toThrow(/approved/);

    const warm = await advanceRunGate({ runId: run.id, to: "warm" });
    expect(warm.gateState).toBe("warm");
    const approved = await advanceRunGate({ runId: warm.id, to: "approved" });
    expect(approved.gateState).toBe("approved");
    const published = await advanceRunGate({
      runId: approved.id,
      to: "published",
    });
    expect(published.gateState).toBe("published");
    expect(published.summary).toMatch(/Simulated publish/);
  });
});
