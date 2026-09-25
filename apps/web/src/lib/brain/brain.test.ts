import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  brainOwner,
  brainUserId,
  ensureBrain,
  loadBrain,
  loadSkillContext,
  mayRouteCta,
  parseBrainDocument,
  parseList,
  loadBrain as load,
  type BrainDocument,
} from "./index";

/**
 * The two rules this file exists to hold in place, both quoted from
 * matos-brain/README.md:
 *
 *   "`read_by` — the skills permitted to read this file. A skill not listed
 *    here should not see it."
 *
 *   "Nothing with `status: draft` should route a live CTA."
 *
 * Both are the kind of rule that is easy to write in a README and easy to
 * forget in code, because forgetting it still produces a working draft. The
 * assertions are therefore on the *absence* — a withheld file, a refused CTA —
 * rather than on the happy path that would pass either way.
 *
 * The isolation tests run against a real temp directory with two real brains,
 * because the store's whole job is filesystem separation and a mocked fs would
 * assert the mock instead.
 */

let tmpRoot: string;

function fm(fields: Record<string, string>, body = "Body.\n"): string {
  const lines = Object.entries(fields).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join("\n")}\n---\n\n${body}`;
}

async function writeBrainFile(
  root: string,
  rel: string,
  content: string,
): Promise<void> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, "utf8");
}

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "matos-brains-"));
  process.env.BRAIN_ROOT = tmpRoot;

  // The seed: two files with different read_by lists, one draft and one active.
  await writeBrainFile(
    path.join(tmpRoot, "seed"),
    "voice/samples.md",
    fm({
      id: "voice.operator-default",
      kind: "voice-profile",
      status: "draft",
      read_by: "[content-calendar, hook-lab]",
      author: "agent",
      source: "reconstructed from owner positioning; NOT yet corrected by owner",
    }),
  );
  await writeBrainFile(
    path.join(tmpRoot, "seed"),
    "voice/banned.md",
    fm({
      id: "voice.banned",
      kind: "voice-guardrail",
      status: "active",
      read_by: "[content-calendar, hook-lab]",
      author: "agent",
    }),
  );
  // Not readable by hook-lab — the allowlist has to actually exclude.
  await writeBrainFile(
    path.join(tmpRoot, "seed"),
    "products/matos.md",
    fm({
      id: "offers.matos",
      kind: "offer-ladder",
      status: "incomplete",
      read_by: "[offer-ladder, cta-router]",
      audience: "[audience.producer-os]",
      author: "agent",
      revised: "2026-09-25",
    }),
  );
  await writeBrainFile(path.join(tmpRoot, "seed"), "README.md", "# Brain\n\nRules.\n");
});

afterAll(async () => {
  delete process.env.BRAIN_ROOT;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("front-matter parsing", () => {
  it("rejects a file whose status is outside the contract", () => {
    const parsed = parseBrainDocument(
      "voice/x.md",
      fm({ id: "voice.x", kind: "voice-profile", status: "final", author: "agent" }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("unreachable");
    expect(parsed.reason).toContain("status must be one of");
  });

  it("rejects a file with no front matter instead of treating it as knowledge", () => {
    const parsed = parseBrainDocument("notes.md", "# Just a note\n");
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("unreachable");
    expect(parsed.reason).toContain("front-matter");
  });

  it("treats a missing read_by as nobody, never as everybody", () => {
    const parsed = parseBrainDocument(
      "strategy/x.md",
      fm({ id: "strategy.x", kind: "goals", status: "active", author: "agent" }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error("unreachable");
    expect(parsed.document.readBy).toEqual([]);
  });

  it("rejects a duplicate key rather than letting the last one win", () => {
    const text = "---\nid: a\nid: b\nkind: goals\nstatus: active\nauthor: agent\n---\n";
    const parsed = parseBrainDocument("strategy/x.md", text);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("unreachable");
    expect(parsed.reason).toContain("duplicate");
  });

  it("parses inline lists and a bare scalar", () => {
    expect(parseList("[a, b ,c]")).toEqual(["a", "b", "c"]);
    expect(parseList("solo")).toEqual(["solo"]);
    expect(parseList(undefined)).toEqual([]);
    expect(() => parseList("[a, b")).toThrow(/unterminated/);
  });
});

describe("brain store", () => {
  it("normalizes an email into a directory-safe owner id", () => {
    expect(brainUserId("  Macnet@MatOS.Local ")).toBe("macnet@matos.local");
    expect(brainUserId(null)).toBeNull();
    expect(brainUserId("")).toBeNull();
  });

  it("refuses an id that could escape the brain root", () => {
    // Traversal is rejected, not escaped — there is no legitimate email that
    // looks like this, so the honest answer is "no such account".
    expect(brainUserId("../seed")).toBeNull();
    expect(brainUserId("a/b")).toBeNull();
    expect(brainUserId("..")).toBeNull();
  });

  it("clones the seed on signup and does not re-clone over an edit", async () => {
    const first = await ensureBrain("clone-test@matos.test");
    expect(first.created).toBe(true);

    // The user corrects their voice — the corrections are the point.
    await fs.writeFile(
      path.join(first.dir, "voice/samples.md"),
      fm({
        id: "voice.operator-default",
        kind: "voice-profile",
        status: "active",
        read_by: "[content-calendar]",
        author: "owner",
      }, "My actual voice.\n"),
      "utf8",
    );

    const second = await ensureBrain("clone-test@matos.test");
    expect(second.created).toBe(false);
    const kept = await fs.readFile(path.join(second.dir, "voice/samples.md"), "utf8");
    expect(kept).toContain("My actual voice");

    // And the seed was not touched by the edit — the clone is a copy, so
    // editing one account can never rewrite another's voice.
    const seed = await fs.readFile(
      path.join(tmpRoot, "seed", "voice/samples.md"),
      "utf8",
    );
    expect(seed).not.toContain("My actual voice");
    expect(seed).toContain("NOT yet corrected by owner");
  });
});

describe("read_by allowlist", () => {
  it("hides a file from a skill not listed in its read_by", async () => {
    await ensureBrain("allowlist@matos.test");
    const owner = brainOwner("allowlist@matos.test");

    const hookLab = await loadBrain({ owner, skill: "hook-lab" });
    const visible = hookLab.documents.map((d) => d.path);
    expect(visible).toContain("voice/samples.md");
    expect(visible).not.toContain("products/matos.md");

    // The exclusion is reported, not silent — a skill author debugging an
    // empty draft needs to see that the file exists and was withheld.
    expect(hookLab.withheld).toContain("products/matos.md");

    const offerLadder = await loadBrain({ owner, skill: "offer-ladder" });
    expect(offerLadder.documents.map((d) => d.path)).toEqual(["products/matos.md"]);
  });

  it("shows nothing at all to a skill the brain never heard of", async () => {
    await ensureBrain("unknown-skill@matos.test");
    const brain = await loadBrain({
      owner: brainOwner("unknown-skill@matos.test"),
      skill: "some-new-skill",
    });
    expect(brain.documents).toEqual([]);
    expect(brain.withheld).toEqual(["products/matos.md", "voice/banned.md", "voice/samples.md"]);
  });

  it("reads empty, not everything, without an owner", async () => {
    const brain = await loadBrain({ owner: null, skill: "hook-lab" });
    expect(brain.documents).toEqual([]);
    expect(brain.withheld).toEqual([]);
  });

  it("reads empty for an account whose brain was never seeded", async () => {
    // Not an error: onboarding has not run yet, and the loader does not get to
    // decide whether that is allowed. It must not fall back to the seed either
    // — a fallback here is exactly the live-reference trap.
    const brain = await loadBrain({
      owner: brainOwner("never-onboarded@matos.test"),
      skill: "hook-lab",
    });
    expect(brain.documents).toEqual([]);
  });

  it("keeps one account's brain out of another's", async () => {
    await ensureBrain("brain-a@matos.test");
    await ensureBrain("brain-b@matos.test");
    await writeBrainFile(
      path.join(tmpRoot, "brain-b@matos.test"),
      "voice/samples.md",
      fm({
        id: "voice.operator-default",
        kind: "voice-profile",
        status: "active",
        read_by: "[hook-lab]",
        author: "owner",
      }, "B's private voice.\n"),
    );

    const asA = await loadBrain({ owner: brainOwner("brain-a@matos.test"), skill: "hook-lab" });
    expect(asA.documents.every((d) => !d.body.includes("B's private voice"))).toBe(true);

    const asB = await loadBrain({ owner: brainOwner("brain-b@matos.test"), skill: "hook-lab" });
    expect(asB.documents.some((d) => d.body.includes("B's private voice"))).toBe(true);
  });
});

describe("draft files cannot route a live CTA", () => {
  function doc(status: BrainDocument["status"]): BrainDocument {
    return {
      id: "x",
      kind: "voice-profile",
      status,
      author: "agent",
      readBy: [],
      profiles: [],
      audience: [],
      offers: [],
      revised: null,
      source: null,
      path: "voice/x.md",
      body: "",
    };
  }

  it("refuses draft and incomplete, allows only active", () => {
    expect(mayRouteCta(doc("draft"))).toBe(false);
    expect(mayRouteCta(doc("incomplete"))).toBe(false);
    expect(mayRouteCta(doc("active"))).toBe(true);
  });

  it("separates routable from provisional context for a drafting skill", async () => {
    await ensureBrain("routing@matos.test");
    const { routable, provisional, brain } = await loadSkillContext({
      owner: brainOwner("routing@matos.test"),
      skill: "content-calendar",
    });

    // voice/samples.md is draft, voice/banned.md is active, and
    // products/matos.md is incomplete — all three are readable by this skill.
    expect(brain.documents.map((d) => d.path).sort()).toEqual([
      "voice/banned.md",
      "voice/samples.md",
    ]);
    expect(routable.map((d) => d.path)).toEqual(["voice/banned.md"]);
    expect(provisional.map((d) => d.path)).toEqual(["voice/samples.md"]);

    // The unroutable ids are surfaced so the desk can say *why* a CTA is
    // simulated instead of just refusing without explanation.
    expect(brain.unroutable).toContain("voice.operator-default");
    expect(brain.unroutable).not.toContain("voice.banned");
  });
});

describe("loader hygiene", () => {
  it("reports a malformed file without taking the rest of the brain down", async () => {
    await ensureBrain("broken-file@matos.test");
    await writeBrainFile(
      path.join(tmpRoot, "broken-file@matos.test"),
      "strategy/goals.md",
      "no front matter at all\n",
    );

    // Read as a skill the seed actually grants, so a non-zero count proves the
    // good files survived — reading as an unlisted skill would return nothing
    // for an unrelated reason and the assertion would pass without testing.
    const brain = await load({ owner: brainOwner("broken-file@matos.test"), skill: "hook-lab" });
    expect(brain.errors.map((e) => e.path)).toContain("strategy/goals.md");
    // The good files still loaded.
    expect(brain.documents.length).toBeGreaterThan(0);
    expect(brain.documents.some((d) => d.path === "strategy/goals.md")).toBe(false);
  });

  it("does not treat README.md as knowledge", async () => {
    await ensureBrain("readme@matos.test");
    const brain = await loadBrain({ owner: brainOwner("readme@matos.test"), skill: "anything" });
    expect(brain.documents.map((d) => d.path)).not.toContain("README.md");
    expect(brain.withheld).not.toContain("README.md");
  });
});
