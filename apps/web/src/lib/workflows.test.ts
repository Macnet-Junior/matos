import { describe, expect, it } from "vitest";
import {
  canAdvanceGate,
  canSimulatePublish,
  isNextGate,
  isPublishSkill,
} from "./workflows-client";
import {
  createWorkflowSchema,
  advanceGateSchema,
  updateWorkflowSchema,
} from "./validation";

describe("content gate transitions", () => {
  it("allows sequential advances", () => {
    expect(isNextGate("draft", "warm")).toBe(true);
    expect(canAdvanceGate("draft", "warm").ok).toBe(true);
    expect(canAdvanceGate("warm", "approved").ok).toBe(true);
    expect(canAdvanceGate("approved", "scheduled").ok).toBe(true);
    expect(canAdvanceGate("scheduled", "published").ok).toBe(true);
  });

  it("blocks publish without approved", () => {
    expect(canAdvanceGate("draft", "published").ok).toBe(false);
    expect(canAdvanceGate("warm", "published").ok).toBe(false);
    expect(canAdvanceGate("approved", "published").ok).toBe(true);
  });

  it("rejects skipping gates", () => {
    expect(canAdvanceGate("draft", "approved").ok).toBe(false);
    expect(canAdvanceGate("warm", "scheduled").ok).toBe(false);
  });

  it("knows when simulated publish is allowed", () => {
    expect(canSimulatePublish("draft")).toBe(false);
    expect(canSimulatePublish("warm")).toBe(false);
    expect(canSimulatePublish("approved")).toBe(true);
  });

  it("flags publish-oriented skills", () => {
    expect(isPublishSkill("scheduler")).toBe(true);
    expect(isPublishSkill("etsy-publish")).toBe(true);
    expect(isPublishSkill("whatsapp-drop")).toBe(true);
    expect(isPublishSkill("hook-lab")).toBe(false);
  });
});

describe("workflow validation", () => {
  it("accepts create payload", () => {
    const parsed = createWorkflowSchema.safeParse({
      name: "Research to Calendar",
      slug: "research-to-calendar",
      description: "Sample",
      skillIds: ["skill-a", "skill-b"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty skill chain", () => {
    const parsed = createWorkflowSchema.safeParse({
      name: "Empty",
      slug: "empty",
      skillIds: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts gate advance payload", () => {
    expect(advanceGateSchema.safeParse({ to: "warm" }).success).toBe(true);
    expect(advanceGateSchema.safeParse({ to: "hot" }).success).toBe(false);
  });

  it("accepts update with reordered skills", () => {
    const parsed = updateWorkflowSchema.safeParse({
      skillIds: ["a", "b", "c"],
      gateState: "warm",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("publish gate enforcement (phase 4b)", () => {
  it("requires approved+ before simulated publish path", () => {
    expect(canSimulatePublish("draft")).toBe(false);
    expect(canSimulatePublish("warm")).toBe(false);
    expect(canSimulatePublish("approved")).toBe(true);
    expect(canSimulatePublish("scheduled")).toBe(true);
    expect(canSimulatePublish("published")).toBe(true);
  });
});
