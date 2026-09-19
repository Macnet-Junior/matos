import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import {
  applyKnowledgeZip,
  buildKnowledgeZip,
  normalizeKnowledgeZipEntry,
} from "./knowledge-archive";
import { listKnowledgeMarkdown } from "./knowledge";

describe("normalizeKnowledgeZipEntry", () => {
  it("keeps knowledge/ prefix and maps folder-relative files", () => {
    expect(normalizeKnowledgeZipEntry("knowledge/brand/voice.md")).toEqual({
      rel: "knowledge/brand/voice.md",
    });
    expect(normalizeKnowledgeZipEntry("brand/voice.md")).toEqual({
      rel: "knowledge/brand/voice.md",
    });
    expect(
      normalizeKnowledgeZipEntry("export/knowledge/content/mix-ratios.md"),
    ).toEqual({ rel: "knowledge/content/mix-ratios.md" });
  });

  it("rejects path traversal and absolute paths", () => {
    expect(normalizeKnowledgeZipEntry("../etc/passwd.md")).toEqual({
      reject: "Path traversal rejected: ../etc/passwd.md",
    });
    expect(normalizeKnowledgeZipEntry("knowledge/../../etc/passwd.md")).toEqual({
      reject: "Path traversal rejected: knowledge/../../etc/passwd.md",
    });
    expect(normalizeKnowledgeZipEntry("C:\\Windows\\x.md")).toMatchObject({
      reject: expect.stringContaining("Absolute path"),
    });
    expect(normalizeKnowledgeZipEntry("knowledge/\0evil.md")).toEqual({
      reject: "Null byte in path",
    });
  });

  it("skips junk and non-markdown", () => {
    expect(normalizeKnowledgeZipEntry("__MACOSX/._voice.md")).toMatchObject({
      skip: expect.any(String),
    });
    expect(normalizeKnowledgeZipEntry("knowledge/notes.txt")).toMatchObject({
      skip: expect.any(String),
    });
    expect(normalizeKnowledgeZipEntry("knowledge/brand/")).toMatchObject({
      skip: expect.any(String),
    });
  });
});

describe("knowledge zip merge", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  async function tempRepo() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "matos-knowledge-"));
    dirs.push(root);
    await fs.mkdir(path.join(root, "knowledge", "brand"), { recursive: true });
    await fs.writeFile(
      path.join(root, "knowledge", "brand", "voice.md"),
      "# voice\n",
      "utf8",
    );
    return root;
  }

  it("exports the markdown tree and merge-imports without wiping extras", async () => {
    const root = await tempRepo();
    await fs.writeFile(
      path.join(root, "knowledge", "keep-me.md"),
      "# stay\n",
      "utf8",
    );

    const { buffer, files } = await buildKnowledgeZip(root);
    expect(files).toEqual(
      expect.arrayContaining([
        "knowledge/brand/voice.md",
        "knowledge/keep-me.md",
      ]),
    );

    const zip = new JSZip();
    zip.file("knowledge/brand/voice.md", "# overwritten\n");
    zip.file("research/notes.md", "# new notes\n");
    const incoming = await zip.generateAsync({ type: "nodebuffer" });

    const applied = await applyKnowledgeZip(incoming, {
      confirm: true,
      base: root,
    });
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.result.written).toEqual(
      expect.arrayContaining([
        "knowledge/brand/voice.md",
        "knowledge/research/notes.md",
      ]),
    );
    expect(applied.result.overwritten).toContain("knowledge/brand/voice.md");

    const listed = await listKnowledgeMarkdown(root);
    expect(listed).toEqual(
      expect.arrayContaining([
        "knowledge/brand/voice.md",
        "knowledge/keep-me.md",
        "knowledge/research/notes.md",
      ]),
    );
    const voice = await fs.readFile(
      path.join(root, "knowledge", "brand", "voice.md"),
      "utf8",
    );
    expect(voice).toBe("# overwritten\n");
    const kept = await fs.readFile(
      path.join(root, "knowledge", "keep-me.md"),
      "utf8",
    );
    expect(kept).toBe("# stay\n");
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it("requires confirm and rejects traversal entries", async () => {
    const root = await tempRepo();
    const zip = new JSZip();
    zip.file("knowledge/../../etc/passwd.md", "nope");
    const incoming = await zip.generateAsync({ type: "nodebuffer" });

    const unconfirmed = await applyKnowledgeZip(incoming, {
      confirm: false,
      base: root,
    });
    expect(unconfirmed.ok).toBe(false);
    if (!unconfirmed.ok) {
      expect(unconfirmed.error).toMatch(/Confirmation required/);
    }

    const rejected = await applyKnowledgeZip(incoming, {
      confirm: true,
      base: root,
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.error).toMatch(/outside knowledge/);
      expect(rejected.rejected?.length).toBeGreaterThan(0);
    }
  });
});
