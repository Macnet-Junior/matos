const SAFE_CODES = new Set([
  "approval_required",
  "destination_rejected",
  "package_invalid",
  "private_field_rejected",
  "publication not found",
  "publication is required",
  "unsupported metric kind",
  "metric value is out of range",
  "invalid metric window",
  "import is empty",
  "import exceeds 500 rows",
  "invalid json import",
  "invalid csv import",
  "unsupported content platform",
  "Calendar item not found",
  "Unsupported content platform",
  "insight not found",
  "insight summary is out of range",
  "insight must be reviewed before it can link to skills or knowledge",
  "skill not found",
  "invalid knowledge path",
  "knowledge file not found",
  "skill or knowledge link is required",
  "subject email is required",
  "privacy request not found",
]);

export function clientSafeError(error: unknown, fallback = "Request failed"): string {
  const message = error instanceof Error ? error.message : fallback;
  if (SAFE_CODES.has(message)) return message;
  if (/bearer|token|secret|api[_-]?key|sk_live|sk_test|password/i.test(message)) {
    return fallback;
  }
  if (message.length > 180) return fallback;
  return message;
}
