import { prisma } from "@matos/db";
import { appendActivity } from "@/lib/map-data";
import {
  publishDeskCalendarItem,
  reconcileDeskPublication,
} from "@/lib/content-publications";

/**
 * The scheduler — what turns a `planned` calendar item into a delivery.
 *
 * The Desk's whole promise is that nothing leaves the building without an
 * approved gate. A scheduler is where that promise is easiest to break: it is
 * the one piece of the system that acts without a human in the loop, on a
 * timer, at a time nobody is watching. So this module is written so that the
 * *only* thing it can do is deliver work a human already approved, and every
 * refusal is explicit rather than a silent skip.
 *
 * Three gates stand between a row and a delivery, and all three are checked
 * here rather than trusted from the row's status:
 *
 * 1. The Clock artifact must be approved. A job can reach `filed` with calendar
 *    rows only after Clock was approved — but a row's own status is a claim,
 *    not a proof, and this is the last check before an outward action.
 * 2. The item must not be a fallback brief. `fallback_brief` rows hold the
 *    brief restated, not a channel draft, and delivering one would publish
 *    something that reads like content and was never written.
 * 3. The item must not already have been through the publisher. Idempotency is
 *    not an optimisation here: a scheduler that re-fires after a restart must
 *    not post twice.
 *
 * Gate 3 lives in `dueCalendarItems`'s WHERE clause rather than as a
 * re-check of `row.status` after the read, because an item the publisher has
 * touched ends up in one of several terminal statuses — `published`, `failed`,
 * or `simulated` when no live provider is configured — and the last of those
 * is easy to mistake for "still pending". A row that reached `simulated` has
 * had its delivery attempt made; selecting it again would re-run the publisher
 * on every tick forever.
 */

/**
 * Statuses the publisher has already acted on. None of these is "due": each
 * one records an attempt that has happened, and a scheduler only ever starts
 * attempts, it does not repeat them.
 *
 * Excluded on purpose alongside these is `invalid`: an item whose package
 * failed validation is not late, it is wrong, and retrying it on a schedule
 * would just fail on a timer. It stays for a human to see.
 */
const ACTED_ON_STATUSES = ["published", "failed", "simulated"] as const;

/**
 * Statuses that mean "the delivery attempt has been made but its outcome is
 * still open": the publisher accepted a post for a future time, or the remote
 * side has not reported back yet. These are not due — re-running the publisher
 * on them would post twice — but they *are* the rows a reconcile pass has to
 * look at, because a scheduled post that went out at 09:00 would otherwise sit
 * at `planned` forever and the Calendar would keep showing a post that already
 * left.
 */
const IN_FLIGHT_STATUSES = ["planned", "publishing", "scheduled"] as const;

/** Items the scheduler is willing to act on, oldest first. */
export async function dueCalendarItems(input: {
  now?: Date;
  limit?: number;
}): Promise<
  Array<{
    id: string;
    jobId: string;
    channel: string;
    title: string;
    scheduledAt: string;
    status: string;
  }>
> {
  const now = input.now ?? new Date();
  const rows = await prisma.deskCalendarItem.findMany({
    where: {
      scheduledAt: { lte: now },
      status: { notIn: [...ACTED_ON_STATUSES, "invalid", "fallback_brief"] },
    },
    orderBy: { scheduledAt: "asc" },
    take: input.limit ?? 25,
  });
  return rows.map((row) => ({
    id: row.id,
    jobId: row.jobId,
    channel: row.channel,
    title: row.title,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
  }));
}

export type SchedulerOutcome = {
  considered: number;
  delivered: number;
  skipped: number;
  failed: number;
  results: Array<{
    calendarItemId: string;
    channel: string;
    outcome: "delivered" | "skipped" | "failed";
    reason: string;
  }>;
};

/**
 * Deliver everything that is due, once.
 *
 * `actorEmail` is the identity recorded on the resulting publication and
 * activity rows. It is not the person who approved — that was recorded at the
 * gate — it is the actor who *caused* this run, which is the scheduler itself.
 * Passing the owner's email here would make an automated delivery look like a
 * human one in the audit trail, which is the one thing the trail is for.
 */
export async function runDueDeliveries(input: {
  actorEmail: string;
  now?: Date;
  limit?: number;
}): Promise<SchedulerOutcome> {
  const due = await dueCalendarItems({ now: input.now, limit: input.limit });
  const outcome: SchedulerOutcome = {
    considered: due.length,
    delivered: 0,
    skipped: 0,
    failed: 0,
    results: [],
  };

  for (const item of due) {
    const row = await prisma.deskCalendarItem.findUnique({
      where: { id: item.id },
      include: { job: { include: { artifacts: true } } },
    });
    if (!row) {
      outcome.skipped += 1;
      outcome.results.push({
        calendarItemId: item.id,
        channel: item.channel,
        outcome: "skipped",
        reason: "not_found",
      });
      continue;
    }

    // Gate 1 — the Clock artifact must carry a human's approval.
    const clock = row.job.artifacts.find((a) => a.stage === "clock");
    if (!clock || clock.reviewState !== "approved") {
      outcome.skipped += 1;
      outcome.results.push({
        calendarItemId: item.id,
        channel: item.channel,
        outcome: "skipped",
        reason: "clock_not_approved",
      });
      continue;
    }

    // Gate 2 — a fallback brief is not a draft, and scheduling one is a
    // mistake that must not become a post.
    const pkg = parsePackageFlag(row.packageJson);
    if (pkg.fallback || row.status === "fallback_brief") {
      outcome.skipped += 1;
      outcome.results.push({
        calendarItemId: item.id,
        channel: item.channel,
        outcome: "skipped",
        reason: "fallback_brief",
      });
      continue;
    }

    // Gate 3 — never re-deliver. The selection query already excludes these,
    // so reaching this branch means the row changed between the two reads. It
    // is kept because the cost of being wrong here is a second post: the query
    // is the fast path, and this is the check that does not depend on the query
    // being right.
    if ((ACTED_ON_STATUSES as readonly string[]).includes(row.status)) {
      outcome.skipped += 1;
      outcome.results.push({
        calendarItemId: item.id,
        channel: item.channel,
        outcome: "skipped",
        reason: `already_${row.status}`,
      });
      continue;
    }

    try {
      const publication = await publishDeskCalendarItem({
        calendarItemId: item.id,
        actorEmail: input.actorEmail,
      });
      // `planned` is an in-flight publication, not a delivered one. Counting it
      // as delivered would let the scheduler report a post that has not gone
      // out — the exact overclaim the Desk's gate exists to prevent. Only
      // `published` counts, and everything else carries its real status back.
      const delivered = publication.status === "published";
      if (delivered) outcome.delivered += 1;
      else outcome.skipped += 1;
      outcome.results.push({
        calendarItemId: item.id,
        channel: item.channel,
        outcome: delivered ? "delivered" : "skipped",
        reason: delivered ? "published" : `publication_${publication.status}`,
      });
    } catch (err) {
      // A scheduled delivery that fails must be loud. Swallowing it here would
      // leave a post the owner believes went out silently unposted.
      const reason = err instanceof Error ? err.message : "delivery_failed";
      outcome.failed += 1;
      outcome.results.push({
        calendarItemId: item.id,
        channel: item.channel,
        outcome: "failed",
        reason,
      });
      await appendActivity({
        action: "desk.schedule.delivery_failed",
        entityType: "desk_calendar_item",
        entityId: item.id,
        summary: `Scheduled delivery failed for ${item.channel}: ${reason}`,
        actorEmail: input.actorEmail,
        payload: { channel: item.channel, reason },
      });
    }
  }

  if (outcome.considered > 0) {
    await appendActivity({
      action: "desk.schedule.ran",
      entityType: "desk_schedule",
      entityId: input.now?.toISOString() ?? new Date().toISOString(),
      summary: `Scheduler: ${outcome.delivered} delivered, ${outcome.skipped} skipped, ${outcome.failed} failed of ${outcome.considered} due`,
      actorEmail: input.actorEmail,
      payload: { ...outcome },
    });
  }

  return outcome;
}

/**
 * Read back everything already in flight, once.
 *
 * The complement of `runDueDeliveries`: that one starts attempts, this one
 * finishes them. Separated because the two must never be confused — a
 * reconcile that delivered would double-post, and a delivery pass that
 * reconciled would leave scheduled posts unstarted. Both run on the same tick.
 *
 * A simulated publication is left alone: `reconcileDeskPublication` reads
 * `simulated` from the stored meta and returns without polling, so there is
 * nothing to ask and nothing to promote.
 */
export async function reconcileInFlightPublications(input: {
  actorEmail: string;
  limit?: number;
}): Promise<{ considered: number; settled: number; stillOpen: number }> {
  const rows = await prisma.deskPublication.findMany({
    where: { status: { in: [...IN_FLIGHT_STATUSES] } },
    orderBy: { lastAttemptAt: "asc" },
    take: input.limit ?? 25,
    select: { id: true },
  });
  let settled = 0;
  let stillOpen = 0;
  for (const row of rows) {
    const updated = await reconcileDeskPublication({
      publicationId: row.id,
      actorEmail: input.actorEmail,
    });
    // `planned` coming back means the remote side still has not reported;
    // anything terminal is a delivery whose outcome is now known.
    if (updated.status === "published" || updated.status === "failed") settled += 1;
    else stillOpen += 1;
  }
  return { considered: rows.length, settled, stillOpen };
}

function parsePackageFlag(raw: string): { fallback: boolean } {
  try {
    const parsed = JSON.parse(raw) as { fallback?: unknown };
    return { fallback: parsed?.fallback === true };
  } catch {
    return { fallback: false };
  }
}
