import { prisma } from "@matos/db";
import { redactSensitive } from "./content-observability";

export const PRIVACY_RETENTION_DAYS = {
  metrics: 365,
  activity: 180,
  publications: 730,
  privacyRequests: 30,
} as const;

const SECRET_KEY = /token|secret|password|authorization|api[_-]?key|credential/i;

export function retentionCutoff(kind: keyof typeof PRIVACY_RETENTION_DAYS, now = new Date()): Date {
  const days = PRIVACY_RETENTION_DAYS[kind];
  return new Date(now.getTime() - days * 86_400_000);
}

export function sanitizeExportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeExportValue(item));
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? redactSensitive(value) : value;
  }
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue;
    out[key] = sanitizeExportValue(inner);
  }
  return out;
}

export async function requestPrivacyAction(input: {
  kind: "export" | "deletion";
  subjectEmail: string;
  requestedBy: string;
  note?: string;
}) {
  const subjectEmail = input.subjectEmail.trim().toLowerCase();
  if (!subjectEmail.includes("@")) throw new Error("subject email is required");
  return prisma.privacyRequest.create({
    data: {
      kind: input.kind,
      subjectEmail,
      requestedBy: input.requestedBy,
      note: (input.note ?? "").slice(0, 500),
      status: "pending",
    },
  });
}

/** Subject export of Desk content. Credentials and secret-like fields are omitted. */
export async function exportSubjectContent(subjectEmail: string) {
  const email = subjectEmail.trim().toLowerCase();
  const jobs = await prisma.deskJob.findMany({
    where: { createdBy: email },
    include: {
      artifacts: true,
      calendarItems: true,
      publications: { include: { metrics: true } },
    },
  });
  return sanitizeExportValue({
    subjectEmail: email,
    exportedAt: new Date().toISOString(),
    jobs,
  });
}

/**
 * Marks a deletion request complete after review.
 * This scaffold records the decision and does not bulk-delete unrelated rows.
 */
export async function completePrivacyRequest(input: { id: string; actorEmail: string }) {
  const request = await prisma.privacyRequest.findUnique({ where: { id: input.id } });
  if (!request) throw new Error("privacy request not found");
  if (request.kind === "deletion") {
    await prisma.deskJob.deleteMany({ where: { createdBy: request.subjectEmail } });
  }
  return prisma.privacyRequest.update({
    where: { id: request.id },
    data: {
      status: "completed",
      completedAt: new Date(),
      note: redactSensitive(request.note),
    },
  });
}
