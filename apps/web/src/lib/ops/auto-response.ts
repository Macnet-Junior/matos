import { prisma } from "@matos/db";
import { appendActivity } from "@/lib/map-data";
import type { Role } from "@/lib/rbac";

export type AutoGate = "pending" | "approved" | "rejected";

export function canManageAutoResponse(role: Role): boolean {
  return role === "Owner" || role === "Operator";
}

/**
 * HARD RULE: cannot enable a rule unless reviewGate === approved
 * AND actor is Owner/Operator.
 */
export function assertCanEnableRule(input: {
  role: Role;
  reviewGate: string;
}): { ok: true } | { ok: false; error: string } {
  if (!canManageAutoResponse(input.role)) {
    return { ok: false, error: "Only Owner/Operator may enable auto-response rules" };
  }
  if (input.reviewGate !== "approved") {
    return {
      ok: false,
      error: "Cannot enable — reviewGate must be approved (no spam growth bots)",
    };
  }
  return { ok: true };
}

export async function approveRule(input: {
  ruleId: string;
  actorEmail: string;
  role: Role;
}) {
  if (!canManageAutoResponse(input.role)) {
    return { ok: false as const, error: "Forbidden" };
  }
  const rule = await prisma.autoResponseRule.update({
    where: { id: input.ruleId },
    data: {
      reviewGate: "approved",
      approvedBy: input.actorEmail,
      approvedAt: new Date(),
    },
  });
  await appendActivity({
    action: "auto-response.approve",
    entityType: "auto_response",
    entityId: rule.id,
    summary: `Approved auto-response rule “${rule.name}”`,
    actorEmail: input.actorEmail,
  });
  return { ok: true as const, rule };
}

export async function setRuleEnabled(input: {
  ruleId: string;
  enabled: boolean;
  actorEmail: string;
  role: Role;
}) {
  const existing = await prisma.autoResponseRule.findUnique({
    where: { id: input.ruleId },
  });
  if (!existing) return { ok: false as const, error: "Rule not found", status: 404 as const };

  if (input.enabled) {
    const gate = assertCanEnableRule({
      role: input.role,
      reviewGate: existing.reviewGate,
    });
    if (!gate.ok) return { ok: false as const, error: gate.error, status: 403 as const };
  } else if (!canManageAutoResponse(input.role)) {
    return { ok: false as const, error: "Forbidden", status: 403 as const };
  }

  const rule = await prisma.autoResponseRule.update({
    where: { id: input.ruleId },
    data: { enabled: input.enabled },
  });
  await appendActivity({
    action: input.enabled ? "auto-response.enable" : "auto-response.disable",
    entityType: "auto_response",
    entityId: rule.id,
    summary: `${input.enabled ? "Enabled" : "Disabled"} auto-response “${rule.name}”`,
    actorEmail: input.actorEmail,
  });
  return { ok: true as const, rule };
}

export async function logAttempt(input: {
  ruleId: string;
  status: "attempted" | "blocked" | "sent_sim";
  detail?: string;
  actorEmail?: string | null;
}) {
  return prisma.autoResponseAttempt.create({
    data: {
      ruleId: input.ruleId,
      status: input.status,
      detail: input.detail ?? "",
      actorEmail: input.actorEmail ?? null,
    },
  });
}
