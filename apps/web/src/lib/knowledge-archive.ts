import JSZip from "jszip";
import {
  knowledgeFileExists,
  listKnowledgeMarkdown,
  readKnowledgeFile,
  repoRoot,
  resolveKnowledgePath,
  writeKnowledgeFile,
} from "@/lib/knowledge";

export const MAX_KNOWLEDGE_ZIP_BYTES = 10 * 1024 * 1024;
export const MAX_KNOWLEDGE_ARCHIVE_FILES = 200;

export type KnowledgeZipEntry = { path: string; content: string };

export type KnowledgeImportResult = {
  written: string[];
  overwritten: string[];
  skipped: string[];
};

/**
 * Map a zip entry onto a knowledge/ relative path.
 * Accepts `knowledge/…`, nested wrappers (`export/knowledge/…`),
 * or folder-relative paths (`brand/voice.md` → `knowledge/brand/voice.md`).
 * Returns null for skippable junk or unsafe traversal.
 */
export function normalizeKnowledgeZipEntry(
  entry: string,
): { rel: string } | { skip: string } | { reject: string } {
  if (!entry || typeof entry !== "string") {
    return { reject: "Empty zip entry" };
  }
  if (entry.includes("\0")) {
    return { reject: "Null byte in path" };
  }
  if (/^[a-zA-Z]:/.test(entry) || entry.startsWith("\\\\")) {
    return { reject: `Absolute path not allowed: ${entry}` };
  }

  let cleaned = entry.replace(/\\/g, "/").replace(/^\/+/, "");
  cleaned = cleaned.replace(/^\.\//, "");
  if (!cleaned || cleaned.endsWith("/")) {
    return { skip: entry };
  }

  const segments = cleaned.split("/");
  if (segments.some((p) => p === ".." || p === "." || p === "")) {
    return { reject: `Path traversal rejected: ${entry}` };
  }
  if (segments.some((p) => p === "__MACOSX" || p.startsWith("."))) {
    return { skip: entry };
  }

  const base = segments[segments.length - 1] ?? "";
  if (!base.toLowerCase().endsWith(".md")) {
    return { skip: entry };
  }

  const knowledgeIdx = segments.indexOf("knowledge");
  const rest =
    knowledgeIdx >= 0 ? segments.slice(knowledgeIdx) : ["knowledge", ...segments];
  if (rest[0] !== "knowledge" || rest.length < 2) {
    return { reject: `Cannot place under knowledge/: ${entry}` };
  }
  const rel = rest.join("/");
  if (!resolveKnowledgePath(rel)) {
    return { reject: `Resolved path escapes knowledge/: ${entry}` };
  }
  return { rel };
}

export async function buildKnowledgeZip(
  base = repoRoot(),
): Promise<{ buffer: Buffer; files: string[] }> {
  const files = await listKnowledgeMarkdown(base);
  const zip = new JSZip();
  for (const rel of files) {
    const result = await readKnowledgeFile(rel, base);
    if ("error" in result) continue;
    zip.file(rel, result.content);
  }
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { buffer, files };
}

export async function applyKnowledgeZip(
  buffer: Buffer,
  opts: { confirm: boolean; base?: string },
): Promise<
  | { ok: true; result: KnowledgeImportResult }
  | { ok: false; status: number; error: string; rejected?: string[] }
> {
  if (!opts.confirm) {
    return {
      ok: false,
      status: 400,
      error:
        "Confirmation required. Merge policy: files in the zip overwrite matching paths under knowledge/; other files are left in place. Retry with confirm=1.",
    };
  }
  if (buffer.byteLength > MAX_KNOWLEDGE_ZIP_BYTES) {
    return { ok: false, status: 400, error: "Zip exceeds 10MB limit" };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return { ok: false, status: 400, error: "Invalid zip archive" };
  }

  const rejected: string[] = [];
  const skipped: string[] = [];
  const planned: KnowledgeZipEntry[] = [];

  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) {
      skipped.push(name);
      continue;
    }
    const mapped = normalizeKnowledgeZipEntry(name);
    if ("skip" in mapped) {
      skipped.push(mapped.skip);
      continue;
    }
    if ("reject" in mapped) {
      rejected.push(mapped.reject);
      continue;
    }
    const content = await entry.async("string");
    planned.push({ path: mapped.rel, content });
  }

  if (rejected.length) {
    return {
      ok: false,
      status: 400,
      error: "Zip contains paths outside knowledge/",
      rejected,
    };
  }
  if (planned.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Zip contains no markdown files under knowledge/",
    };
  }
  if (planned.length > MAX_KNOWLEDGE_ARCHIVE_FILES) {
    return {
      ok: false,
      status: 400,
      error: `Zip exceeds ${MAX_KNOWLEDGE_ARCHIVE_FILES} markdown files`,
    };
  }

  const unique = new Map<string, string>();
  for (const item of planned) {
    unique.set(item.path, item.content);
  }

  const base = opts.base ?? repoRoot();
  const written: string[] = [];
  const overwritten: string[] = [];

  for (const [rel, content] of unique) {
    const existed = await knowledgeFileExists(rel, base);
    const saved = await writeKnowledgeFile(rel, content, base);
    if ("error" in saved) {
      return { ok: false, status: 400, error: `${rel}: ${saved.error}` };
    }
    written.push(rel);
    if (existed) overwritten.push(rel);
  }

  return { ok: true, result: { written, overwritten, skipped } };
}
