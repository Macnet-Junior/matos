import fs from "node:fs/promises";
import path from "node:path";

/**
 * Where a user's brain lives on disk.
 *
 * `brains/<userId>/` under a workspace root — see
 * matos-brain/strategy/tenant-model.md. One directory per account, named by
 * the same identifier the rest of MatOS already scopes by (the lowercased
 * session email), so a brain and a desk job can never disagree about who
 * owns what.
 *
 * `BRAIN_ROOT` exists so tests can point the whole store at a temp directory:
 * the isolation suite needs two real brains, and it must never write into the
 * developer's actual workspace to get them.
 */
export function brainRoot(): string {
  return (
    process.env.BRAIN_ROOT ??
    path.resolve(process.cwd(), "..", "..", "brains")
  );
}

/** The template a new account is cloned from, and the owner's own brain. */
export function seedBrainDir(): string {
  return path.join(brainRoot(), "seed");
}

/**
 * Normalize an owner identifier into a directory name.
 *
 * Lowercased to match `rbac.ownerEmail()` and the desk's `DeskOwner`, so the
 * same person is one account everywhere. Anything that is not
 * `[a-z0-9._@-]` is rejected rather than escaped: a user id reaching the
 * filesystem is a path-traversal question, and the honest answer is that the
 * only legitimate ids are email-shaped. Rejection keeps `../` from ever being
 * a thought, and it means a future caller cannot invent an id scheme whose
 * directory name collides with another's.
 */
export function brainUserId(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  if (!/^[a-z0-9._@-]+$/.test(normalized)) return null;
  if (normalized === "." || normalized === "..") return null;
  return normalized;
}

export function brainDir(userId: string): string {
  return path.join(brainRoot(), userId);
}

export async function brainExists(userId: string): Promise<boolean> {
  try {
    const stat = await fs.stat(brainDir(userId));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Give an account its own brain, by copying the seed.
 *
 * Copy, never reference. tenant-model.md names this as *the trap*: if new
 * users read `seed/` at runtime, then editing the seed silently rewrites the
 * voice of every account that never replaced it, and the owner's own sample
 * passages leak into customers' drafts. A copy costs a few kilobytes once and
 * removes an entire class of leak.
 *
 * Idempotent: an existing brain is left alone. Onboarding may call this on
 * every sign-in, and re-copying would silently discard everything the user
 * had corrected — the corrections are the whole point of the file.
 *
 * Returns the directory it ensured, and whether it created it, so a caller
 * can report "we inferred your voice" exactly once.
 */
export async function ensureBrain(
  userId: string,
): Promise<{ dir: string; created: boolean }> {
  const dir = brainDir(userId);
  if (await brainExists(userId)) return { dir, created: false };

  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.cp(seedBrainDir(), dir, { recursive: true });
  } catch (err) {
    // A cloned-from-nothing brain is worse than no brain: the user would see
    // empty files and think their voice was thrown away. Report it instead.
    throw new Error(
      `Cannot seed brain for ${userId}: ${err instanceof Error ? err.message : "seed unavailable"}`,
    );
  }
  return { dir, created: true };
}
