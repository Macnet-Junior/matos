import { NextResponse } from "next/server";
import { prisma } from "@matos/db";
import { requireOpsView, requireSession } from "@/lib/owner";
import {
  approveRule,
  assertCanEnableRule,
  canManageAutoResponse,
  logAttempt,
  setRuleEnabled,
} from "@/lib/ops/auto-response";
import { appendActivity } from "@/lib/map-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireOpsView();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const rules = await prisma.autoResponseRule.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      attempts: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  return NextResponse.json({
    rules: rules.map((r) => ({
      id: r.id,
      name: r.name,
      triggerKeyword: r.triggerKeyword,
      channel: r.channel,
      template: r.template,
      enabled: r.enabled,
      reviewGate: r.reviewGate,
      approvedBy: r.approvedBy,
      approvedAt: r.approvedAt?.toISOString() ?? null,
      attempts: r.attempts.map((a) => ({
        id: a.id,
        status: a.status,
        detail: a.detail,
        actorEmail: a.actorEmail,
        createdAt: a.createdAt.toISOString(),
      })),
    })),
  });
}

export async function POST(req: Request) {
  const gate = await requireSession();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!canManageAutoResponse(gate.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    ruleId?: string;
    name?: string;
    triggerKeyword?: string;
    channel?: string;
    template?: string;
    enabled?: boolean;
  };

  if (body.action === "create") {
    if (!body.name?.trim() || !body.triggerKeyword?.trim() || !body.template?.trim()) {
      return NextResponse.json({ error: "name, triggerKeyword, template required" }, { status: 400 });
    }
    const rule = await prisma.autoResponseRule.create({
      data: {
        name: body.name.trim(),
        triggerKeyword: body.triggerKeyword.trim().toLowerCase(),
        channel: body.channel?.trim() || "support",
        template: body.template.trim(),
        enabled: false,
        reviewGate: "pending",
      },
    });
    await appendActivity({
      action: "auto-response.create",
      entityType: "auto_response",
      entityId: rule.id,
      summary: `Created auto-response rule “${rule.name}” (pending gate)`,
      actorEmail: gate.email,
    });
    return NextResponse.json({ rule });
  }

  if (!body.ruleId) {
    return NextResponse.json({ error: "ruleId required" }, { status: 400 });
  }

  if (body.action === "approve") {
    const res = await approveRule({
      ruleId: body.ruleId,
      actorEmail: gate.email,
      role: gate.role,
    });
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 403 });
    return NextResponse.json({ rule: res.rule });
  }

  if (body.action === "enable" || body.action === "disable") {
    const enabled = body.action === "enable";
    if (enabled) {
      const existing = await prisma.autoResponseRule.findUnique({
        where: { id: body.ruleId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const check = assertCanEnableRule({
        role: gate.role,
        reviewGate: existing.reviewGate,
      });
      if (!check.ok) {
        await logAttempt({
          ruleId: body.ruleId,
          status: "blocked",
          detail: check.error,
          actorEmail: gate.email,
        });
        return NextResponse.json({ error: check.error }, { status: 403 });
      }
    }
    const res = await setRuleEnabled({
      ruleId: body.ruleId,
      enabled,
      actorEmail: gate.email,
      role: gate.role,
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: res.status });
    }
    return NextResponse.json({ rule: res.rule });
  }

  if (body.action === "attempt") {
    const rule = await prisma.autoResponseRule.findUnique({
      where: { id: body.ruleId },
    });
    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!rule.enabled || rule.reviewGate !== "approved") {
      const attempt = await logAttempt({
        ruleId: rule.id,
        status: "blocked",
        detail: "Rule not enabled or not approved",
        actorEmail: gate.email,
      });
      return NextResponse.json({ attempt, blocked: true }, { status: 403 });
    }
    const attempt = await logAttempt({
      ruleId: rule.id,
      status: "sent_sim",
      detail: `Simulated reply: ${rule.template.slice(0, 120)}`,
      actorEmail: gate.email,
    });
    await appendActivity({
      action: "auto-response.attempt",
      entityType: "auto_response",
      entityId: rule.id,
      summary: `Auto-response attempt (sim) · ${rule.name}`,
      actorEmail: gate.email,
    });
    return NextResponse.json({ attempt, blocked: false });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
