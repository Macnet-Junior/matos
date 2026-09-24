import { parseJsonObject, prisma } from "@matos/db";
import { isContentPlatform } from "./content-platforms";

export const METRIC_KINDS = ["impressions", "clicks", "engagement", "conversions"] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];

const FORBIDDEN_FIELD = /email|phone|e-mail|ip|token|secret|password|audience|userid|user_id|raw|comment/i;

export type MetricDraft = {
  publicationId: string;
  kind: MetricKind;
  value: number;
  capturedAt?: string;
  windowStart?: string;
  windowEnd?: string;
};

function publicationLooksSimulated(publication: {
  externalId: string | null;
  metaJson: string;
}): boolean {
  if (publication.externalId?.startsWith("sim_")) return true;
  const meta = parseJsonObject(publication.metaJson);
  return meta.provider === "simulated" || meta.fallback === true || meta.simulated === true;
}

export function isMetricKind(value: string): value is MetricKind {
  return (METRIC_KINDS as readonly string[]).includes(value);
}

export function assertNoPrivateMetricFields(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_FIELD.test(key)) {
      throw new Error("private_field_rejected");
    }
  }
}

export function validateMetricDraft(input: {
  publicationId?: unknown;
  kind?: unknown;
  value?: unknown;
  capturedAt?: unknown;
  windowStart?: unknown;
  windowEnd?: unknown;
  [key: string]: unknown;
}): MetricDraft {
  const record = input as Record<string, unknown>;
  assertNoPrivateMetricFields(record);
  const publicationId = typeof input.publicationId === "string" ? input.publicationId.trim() : "";
  if (!publicationId) throw new Error("publication is required");
  if (typeof input.kind !== "string" || !isMetricKind(input.kind)) {
    throw new Error("unsupported metric kind");
  }
  if (typeof input.value !== "number" || !Number.isFinite(input.value) || input.value < 0 || input.value > 1_000_000_000) {
    throw new Error("metric value is out of range");
  }
  const capturedAt = typeof input.capturedAt === "string" ? input.capturedAt : undefined;
  const windowStart = typeof input.windowStart === "string" ? input.windowStart : undefined;
  const windowEnd = typeof input.windowEnd === "string" ? input.windowEnd : undefined;
  for (const stamp of [capturedAt, windowStart, windowEnd]) {
    if (stamp && Number.isNaN(Date.parse(stamp))) throw new Error("invalid metric window");
  }
  if (windowStart && windowEnd && Date.parse(windowStart) > Date.parse(windowEnd)) {
    throw new Error("invalid metric window");
  }
  return {
    publicationId,
    kind: input.kind,
    value: input.value,
    capturedAt,
    windowStart,
    windowEnd,
  };
}

export async function ingestContentMetric(draft: MetricDraft) {
  const publication = await prisma.deskPublication.findUnique({
    where: { id: draft.publicationId },
  });
  if (!publication) throw new Error("publication not found");
  if (!isContentPlatform(publication.channel)) throw new Error("unsupported content platform");
  return prisma.contentMetric.create({
    data: {
      publicationId: publication.id,
      kind: draft.kind,
      value: draft.value,
      capturedAt: draft.capturedAt ? new Date(draft.capturedAt) : new Date(),
      metaJson: JSON.stringify({
        windowStart: draft.windowStart ?? null,
        windowEnd: draft.windowEnd ?? null,
        source: "api",
      }),
    },
  });
}

export type MetricImportRow = MetricDraft & { source: "import" };

export function parseMetricImport(payload: string, format: "csv" | "json"): MetricImportRow[] {
  const rows = format === "json" ? parseJsonRows(payload) : parseCsvRows(payload);
  if (rows.length === 0) throw new Error("import is empty");
  if (rows.length > 500) throw new Error("import exceeds 500 rows");
  return rows.map((row) => ({ ...validateMetricDraft(row), source: "import" as const }));
}

function parseJsonRows(payload: string): Array<Record<string, unknown>> {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    throw new Error("invalid json import");
  }
  const rows = Array.isArray(value) ? value : (value as { rows?: unknown })?.rows;
  if (!Array.isArray(rows)) throw new Error("invalid json import");
  return rows.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("invalid json import");
    }
    return row as Record<string, unknown>;
  });
}

function parseCsvRows(payload: string): Array<Record<string, unknown>> {
  const lines = payload.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error("invalid csv import");
  const headers = splitCsvLine(lines[0]!).map((header) => header.trim());
  if (headers.some((header) => FORBIDDEN_FIELD.test(header))) {
    throw new Error("private_field_rejected");
  }
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      const cell = cells[index]?.trim() ?? "";
      if (header === "value") record.value = Number(cell);
      else record[header] = cell;
    });
    return record;
  });
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

export async function importContentMetrics(rows: MetricImportRow[]) {
  const created = [];
  for (const row of rows) {
    const metric = await ingestContentMetric(row);
    created.push(metric);
  }
  return created;
}

export type ChannelPerformance = {
  channel: string;
  publications: number;
  simulated: number;
  live: number;
  metrics: Record<MetricKind, number>;
};

export async function summarizeContentPerformance(): Promise<{
  channels: ChannelPerformance[];
  totals: Record<MetricKind, number>;
}> {
  const publications = await prisma.deskPublication.findMany({
    include: { metrics: true },
  });
  const byChannel = new Map<string, ChannelPerformance>();
  const totals: Record<MetricKind, number> = {
    impressions: 0,
    clicks: 0,
    engagement: 0,
    conversions: 0,
  };
  for (const publication of publications) {
    const row = byChannel.get(publication.channel) ?? {
      channel: publication.channel,
      publications: 0,
      simulated: 0,
      live: 0,
      metrics: { impressions: 0, clicks: 0, engagement: 0, conversions: 0 },
    };
    row.publications += 1;
    const simulated = publicationLooksSimulated(publication);
    if (simulated) row.simulated += 1;
    else row.live += 1;
    for (const metric of publication.metrics) {
      if (!isMetricKind(metric.kind)) continue;
      row.metrics[metric.kind] += metric.value;
      if (!simulated) totals[metric.kind] += metric.value;
    }
    byChannel.set(publication.channel, row);
  }
  return { channels: [...byChannel.values()], totals };
}

export async function listPublicationPerformance() {
  const publications = await prisma.deskPublication.findMany({
    include: {
      metrics: true,
      job: { select: { title: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return publications.map((publication) => {
    const simulated = publicationLooksSimulated(publication);
    const metrics: Record<string, number> = {};
    for (const metric of publication.metrics) {
      metrics[metric.kind] = (metrics[metric.kind] ?? 0) + metric.value;
    }
    return {
      id: publication.id,
      jobId: publication.jobId,
      jobTitle: publication.job.title,
      channel: publication.channel,
      provider: publication.provider,
      status: publication.status,
      simulated,
      error: publication.error,
      metrics,
    };
  });
}
