import { NextResponse } from "next/server";
import { requireWorkflowApprove } from "@/lib/owner";
import {
  assertWhatsAppDestinationAllowed,
  simulateWhatsAppSend,
  WhatsAppClient,
  whatsappConfigFromEnv,
} from "@/lib/integrations/whatsapp";
import { appendActivity } from "@/lib/map-data";

export const dynamic = "force-dynamic";

/**
 * Gated WhatsApp send — Owner/Operator approve permission required.
 * Destination HARD BOUNDARY enforced in whatsapp.ts.
 */
export async function POST(req: Request) {
  const gate = await requireWorkflowApprove();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    to?: string;
    text?: string;
    reviewGateApproved?: boolean;
    dryRun?: boolean;
  };

  if (!body.reviewGateApproved) {
    return NextResponse.json(
      { error: "reviewGateApproved must be true (workflow gate approved+)" },
      { status: 403 },
    );
  }
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const cfg = whatsappConfigFromEnv();
  const to = (body.to ?? cfg.allowedTo ?? "").trim();
  const check = assertWhatsAppDestinationAllowed(to, cfg.allowedTo);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  const dryRun = body.dryRun !== false && !(cfg.token && cfg.phoneNumberId);
  if (dryRun || !cfg.token || !cfg.phoneNumberId) {
    const result = simulateWhatsAppSend({
      to,
      text: body.text,
      allowedTo: cfg.allowedTo,
      reviewGateApproved: true,
    });
    await appendActivity({
      action: "whatsapp.send",
      entityType: "integration",
      entityId: "whatsapp",
      summary: result.ok
        ? `WhatsApp simulated send to allowlisted destination`
        : `WhatsApp blocked: ${result.error}`,
      actorEmail: gate.email,
      payload: { simulated: true, ok: result.ok },
    });
    return NextResponse.json({ result });
  }

  const client = new WhatsAppClient({
    token: cfg.token,
    phoneNumberId: cfg.phoneNumberId,
    allowedTo: cfg.allowedTo!,
  });
  const result = await client.sendText({
    to,
    text: body.text,
    reviewGateApproved: true,
  });
  await appendActivity({
    action: "whatsapp.send",
    entityType: "integration",
    entityId: "whatsapp",
    summary: result.ok
      ? `WhatsApp sent to allowlisted destination`
      : `WhatsApp send failed`,
    actorEmail: gate.email,
    payload: { simulated: false, ok: result.ok, messageId: result.messageId },
  });
  return NextResponse.json({ result }, { status: result.ok ? 200 : 400 });
}
