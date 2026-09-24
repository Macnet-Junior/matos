import { NextResponse } from "next/server";
import { requireOpsManage } from "@/lib/owner";
import { clientSafeError } from "@/lib/client-safe-error";
import {
  completePrivacyRequest,
  exportSubjectContent,
  requestPrivacyAction,
} from "@/lib/content-privacy";

export async function POST(req: Request) {
  const gate = await requireOpsManage();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  try {
    const body = (await req.json()) as {
      action?: string;
      kind?: "export" | "deletion";
      subjectEmail?: string;
      requestId?: string;
    };
    if (body.action === "complete" && body.requestId) {
      const request = await completePrivacyRequest({
        id: body.requestId,
        actorEmail: gate.email,
      });
      return NextResponse.json({ request });
    }
    if (body.action === "export" && body.subjectEmail) {
      const request = await requestPrivacyAction({
        kind: "export",
        subjectEmail: body.subjectEmail,
        requestedBy: gate.email,
      });
      const content = await exportSubjectContent(body.subjectEmail);
      return NextResponse.json({ request, content });
    }
    if (body.kind !== "export" && body.kind !== "deletion") {
      return NextResponse.json({ error: "kind is required" }, { status: 400 });
    }
    const request = await requestPrivacyAction({
      kind: body.kind,
      subjectEmail: body.subjectEmail ?? "",
      requestedBy: gate.email,
    });
    return NextResponse.json({ request });
  } catch (error) {
    return NextResponse.json({ error: clientSafeError(error) }, { status: 400 });
  }
}
