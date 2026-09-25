import {
  readBrainDirectory,
  type BrainDocument,
  type BrainKind,
  type BrainStatus,
} from "./frontmatter";
import { brainDir, brainExists, brainUserId } from "./store";

export * from "./frontmatter";
export * from "./store";

/**
 * The knowledge loader.
 *
 * Every read goes through here, and every read takes the owner first. There is
 * no global singleton and no module-level cache of a loaded brain — a cache
 * keyed by nothing is how one account's voice ends up in another's draft, and
 * a cache keyed by user id is a second source of truth that goes stale the
 * moment the user edits a file. tenant-model.md sets the rule: "If a caller
 * cannot produce a userId, the loader returns empty rather than everything."
 *
 * The failure mode is chosen deliberately. A caller that forgets to scope
 * gets a blank brain and an empty draft, which is visibly wrong and gets
 * fixed. The opposite default — unscoped — fails silently and looks like the
 * product working, right up until a customer reads their competitor's voice.
 */
export type BrainOwner = string & { readonly __brainOwner: unique symbol };

/**
 * A branded owner id, or null.
 *
 * Branded for the same reason `DeskOwner` is: a bare `string` accepts a job
 * id, a channel name, or an offer slug, and every one of those would quietly
 * resolve to a different directory. Naming the type makes the compiler ask
 * the question the scope depends on.
 */
export function brainOwner(
  email: string | null | undefined,
): BrainOwner | null {
  const id = brainUserId(email);
  return (id ? id : null) as BrainOwner | null;
}

export type LoadedBrain = {
  owner: BrainOwner;
  /** Documents the skill is permitted to see, sorted by path. */
  documents: BrainDocument[];
  /** Documents in the brain that `read_by` withholds from this skill. */
  withheld: string[];
  /** Files that could not be parsed. Reported, never silently dropped. */
  errors: { path: string; reason: string }[];
  /** Ids of files held back because they cannot route a live CTA. */
  unroutable: string[];
};

export function emptyBrain(owner: BrainOwner): LoadedBrain {
  return { owner, documents: [], withheld: [], errors: [], unroutable: [] };
}

function grantsRead(doc: BrainDocument, skill: string): boolean {
  // `read_by: []` means nobody, not everybody. An empty allowlist that
  // degrades into "no restriction" is an allowlist that fails open, which is
  // the one way an allowlist must never fail.
  return doc.readBy.includes(skill);
}

/**
 * Load the documents a named skill may see.
 *
 * `skill` is the caller's identity, and it is required rather than defaulted.
 * A default of "everything" would be wrong for the one case that matters (an
 * unknown caller), and a default of "nothing" would be a trap for callers who
 * legitimately read the whole brain — better to make each of them write the
 * name down.
 *
 * A brain that does not exist yet yields an empty result, not an error: the
 * loader must not decide policy for onboarding. `ensureBrain` is the caller's
 * explicit act, so an account that was never seeded reads as empty and the
 * caller can tell the difference between "no voice yet" and "load failed".
 */
export async function loadBrain(input: {
  owner: BrainOwner | null;
  skill: string;
  kinds?: BrainKind[];
}): Promise<LoadedBrain> {
  if (!input.owner) return emptyBrain("" as BrainOwner);

  const owner = input.owner;
  if (!(await brainExists(owner))) return emptyBrain(owner);

  const { documents, errors } = await readBrainDirectory(brainDir(owner));
  const wanted = input.kinds ? new Set<BrainKind>(input.kinds) : null;

  const visible: BrainDocument[] = [];
  const withheld: string[] = [];
  for (const doc of documents) {
    if (!grantsRead(doc, input.skill)) {
      withheld.push(doc.path);
      continue;
    }
    if (wanted && !wanted.has(doc.kind)) continue;
    visible.push(doc);
  }

  return {
    owner,
    documents: visible,
    withheld,
    errors,
    unroutable: visible.filter((d) => !mayRouteCta(d)).map((d) => d.id),
  };
}

/**
 * May this document back a live CTA?
 *
 * README.md states the rule flatly: "Nothing with `status: draft` should route
 * a live CTA." This is the function that makes the sentence true rather than
 * aspirational — a routing caller asks it, and the answer is `false` for every
 * file whose author nobody has confirmed.
 *
 * `incomplete` is also false, and the README does not say so explicitly. It
 * follows from the same reason: `products/matos.md` is a ladder with no prices
 * and `strategy/goals.md` is a plan with no dates, and a CTA built from either
 * asserts a number that does not exist. Requiring `active` for routing is the
 * narrowest reading that is also safe, and it means the owner promotes a file
 * by reviewing it, not by leaving it alone.
 */
export function mayRouteCta(doc: BrainDocument): boolean {
  return doc.status === "active";
}

/**
 * The assembled context for a skill about to draft.
 *
 * Returns the visible documents plus the routing decision already made, so a
 * drafting skill does not have to remember to check status itself. Splitting
 * "what may I read" from "what may I claim" is the point: the first is an
 * allowlist, the second is provenance, and conflating them is how a draft ends
 * up citing a file that is still a guess.
 */
export async function loadSkillContext(input: {
  owner: BrainOwner | null;
  skill: string;
}): Promise<{
  brain: LoadedBrain;
  /** Documents safe to route a live CTA from. */
  routable: BrainDocument[];
  /** Documents readable but not citable as settled fact. */
  provisional: BrainDocument[];
}> {
  const brain = await loadBrain(input);
  const routable: BrainDocument[] = [];
  const provisional: BrainDocument[] = [];

  for (const doc of brain.documents) {
    if (mayRouteCta(doc)) routable.push(doc);
    else provisional.push(doc);
  }
  return { brain, routable, provisional };
}

export type { BrainDocument, BrainKind, BrainStatus };
