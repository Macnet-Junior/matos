import fs from "node:fs/promises";
import path from "node:path";

/**
 * The front-matter contract for brain files.
 *
 * Every file in a brain opens with a `---` block naming what it is, who wrote
 * it, and which skills are allowed to see it (README.md: "A skill not listed
 * here should not see it"). The block is the only structured part of a file
 * and the only part this loader trusts — the prose below it is written for a
 * human, and the engine must never parse meaning out of it.
 */
export const BRAIN_KINDS = [
  "audience",
  "voice-profile",
  "voice-guardrail",
  "offer-ladder",
  "goals",
  "competitive-research",
  "architecture",
  "registry",
] as const;

export type BrainKind = (typeof BRAIN_KINDS)[number];

/**
 * `draft` and `incomplete` are not the same warning.
 *
 * `draft` is unreviewed — nobody has checked it, so it cannot route a live
 * CTA. `incomplete` has blanks the owner has not filled (no prices on the
 * ladder, no dates in the goals); it is reviewed, but a claim taken from it
 * would be a claim taken from a hole. Both are unusable for routing, for
 * different reasons, so they stay distinct here even though the routing answer
 * is the same — collapsing them would lose why a file is unusable, and the
 * fix differs: one needs a read, the other needs a number.
 */
export const BRAIN_STATUSES = ["draft", "active", "incomplete"] as const;

export type BrainStatus = (typeof BRAIN_STATUSES)[number];

/** `author` is `owner`, `agent` or `model` — nothing else (README.md). */
export const BRAIN_AUTHORS = ["owner", "agent", "model"] as const;

export type BrainAuthor = (typeof BRAIN_AUTHORS)[number];

export type BrainFrontmatter = {
  id: string;
  kind: BrainKind;
  status: BrainStatus;
  author: BrainAuthor;
  /** Skills permitted to read this file. Empty means nobody, not everybody. */
  readBy: string[];
  /** Which other author profiles this file is meant to load alongside. */
  profiles: string[];
  /** Audience ids this file is about; mirrors `profiles` for audience files. */
  audience: string[];
  /** Offer ids referenced by this file. */
  offers: string[];
  revised: string | null;
  /** Where the claims came from. "reconstructed" / "pending owner" = a guess. */
  source: string | null;
};

export type BrainDocument = BrainFrontmatter & {
  /** Brain-relative path, e.g. `voice/samples.md`. */
  path: string;
  /** Everything after the closing `---`, verbatim. */
  body: string;
};

export type ParseResult =
  | { ok: true; document: BrainDocument }
  | { ok: false; path: string; reason: string };

/**
 * A hand-rolled parser, not a YAML dependency.
 *
 * The block is flat — scalars and inline `[a, b]` lists, no nesting, no
 * anchors, no multi-line strings. A YAML library would accept far more than
 * the contract allows (nested maps, type coercion of `no` into a boolean) and
 * the extra acceptance is exactly the problem: a file that parses under YAML
 * but means something different to a human is worse than one that fails
 * loudly. Unsupported syntax is a parse error here, on purpose.
 */
export function parseFrontmatter(text: string): {
  fields: Record<string, string>;
  body: string;
} {
  const normalized = text.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error("missing front-matter block");
  }
  const close = normalized.indexOf("\n---", 4);
  if (close === -1) {
    throw new Error("unterminated front-matter block");
  }

  const block = normalized.slice(4, close);
  const body = normalized.slice(close + 4).replace(/^\n/, "");
  const fields: Record<string, string> = {};

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const sep = line.indexOf(":");
    if (sep === -1) throw new Error(`front-matter line is not a key: ${line}`);
    const key = line.slice(0, sep).trim();
    if (!key) throw new Error(`front-matter line has an empty key: ${line}`);
    // Last write wins is silent data loss; a duplicate is a mistake to surface.
    if (key in fields) throw new Error(`duplicate front-matter key: ${key}`);

    fields[key] = line.slice(sep + 1).trim();
  }

  return { fields, body };
}

/** `[a, b]` or bare `a`. A missing key is `[]` — absence is never a wildcard. */
export function parseList(value: string | undefined): string[] {
  if (value === undefined) return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (!trimmed.startsWith("[")) return [trimmed];
  if (!trimmed.endsWith("]")) {
    throw new Error(`unterminated list value: ${trimmed}`);
  }
  return trimmed
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

function requireOneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  field: string,
): T {
  if (!value) throw new Error(`missing required front-matter field: ${field}`);
  const match = allowed.find((candidate) => candidate === value);
  if (!match) {
    throw new Error(`${field} must be one of ${allowed.join(" | ")} — got "${value}"`);
  }
  return match;
}

/**
 * Turn file text into a document, or into a reason it is not one.
 *
 * Never throws: a brain is user-editable, and a malformed file is a state the
 * product has to survive rather than a crash. The result is a value so the
 * caller decides what to do — the loader drops it and reports it, which is
 * louder than silence and does not take the desk down with it.
 */
export function parseBrainDocument(rel: string, text: string): ParseResult {
  try {
    const { fields, body } = parseFrontmatter(text);
    const id = fields.id;
    if (!id) throw new Error("missing required front-matter field: id");

    return {
      ok: true,
      document: {
        id,
        kind: requireOneOf(fields.kind, BRAIN_KINDS, "kind"),
        status: requireOneOf(fields.status, BRAIN_STATUSES, "status"),
        author: requireOneOf(fields.author, BRAIN_AUTHORS, "author"),
        readBy: parseList(fields.read_by),
        profiles: parseList(fields.profiles),
        audience: parseList(fields.audience),
        offers: parseList(fields.offers),
        revised: fields.revised ?? null,
        source: fields.source ?? null,
        path: rel.replace(/\\/g, "/").replace(/^\/+/, ""),
        body,
      },
    };
  } catch (err) {
    return {
      ok: false,
      path: rel,
      reason: err instanceof Error ? err.message : "unreadable front matter",
    };
  }
}

/** The README is part of the brain but not knowledge a skill reads. */
const NON_KNOWLEDGE_FILES = new Set(["readme.md", "index.md"]);

/**
 * Walk a brain directory into documents, sorted by path.
 *
 * Depth is bounded rather than open: the brain layout is one level of
 * folders, and an unbounded walk over a user-controlled directory is a way to
 * make the desk hang on a symlink loop. A file deeper than the bound is
 * skipped rather than erroring — it was never part of the contract.
 */
const MAX_DEPTH = 2;

export async function readBrainDirectory(
  root: string,
): Promise<{ documents: BrainDocument[]; errors: { path: string; reason: string }[] }> {
  const documents: BrainDocument[] = [];
  const errors: { path: string; reason: string }[] = [];

  async function walk(dir: string, prefix: string, depth: number): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (depth > MAX_DEPTH) return;

    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = `${prefix}/${entry.name}`.replace(/^\//, "");

      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
        await walk(abs, rel, depth + 1);
        continue;
      }
      if (!entry.name.endsWith(".md") || entry.name.startsWith(".")) continue;
      if (NON_KNOWLEDGE_FILES.has(entry.name.toLowerCase())) continue;

      let text: string;
      try {
        text = await fs.readFile(abs, "utf8");
      } catch {
        errors.push({ path: rel, reason: "unreadable" });
        continue;
      }

      const parsed = parseBrainDocument(rel, text);
      if (parsed.ok) documents.push(parsed.document);
      else errors.push({ path: parsed.path, reason: parsed.reason });
    }
  }

  await walk(root, "", 1);
  documents.sort((a, b) => a.path.localeCompare(b.path));
  return { documents, errors };
}
