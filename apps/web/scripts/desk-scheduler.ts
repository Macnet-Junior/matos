/**
 * The cron entry point: one tick, then exit.
 *
 * A tick does both passes. `runDueDeliveries` starts work that is due.
 * `reconcileInFlightPublications` reads newsletter and blog posts back from
 * the delivery URL and settles the calendar row. Windows Task Scheduler runs
 * this every few minutes. It is deliberately a one-shot process rather than a
 * resident daemon — a scheduler that fires every few minutes has nothing to
 * do between fires, and a process that loops and sleeps would hold an
 * interpreter and its memory for the privilege of doing nothing.
 *
 * Exit code carries the outcome, because that is what a supervisor can act
 * on: 0 when every due item was delivered or legitimately skipped, 1 when at
 * least one delivery failed. The run itself never throws — a scheduler that
 * dies on an unhandled rejection stops delivering silently, which is the one
 * failure mode worse than a loud one.
 */
import { ownerEmail } from "@/lib/rbac";
import { runSchedulerTick } from "@/lib/desk/scheduler";

async function main() {
  const tick = await runSchedulerTick({
    // The actor is the scheduler, not the owner. The owner's email is used only
    // as the account the run is filed under; stamping it as the actor would
    // make an automated delivery read as a human one in the audit trail.
    actorEmail: `scheduler:${ownerEmail()}`,
  });

  console.log(
    JSON.stringify(
      {
        considered: tick.deliveries.considered,
        delivered: tick.deliveries.delivered,
        skipped: tick.deliveries.skipped,
        failed: tick.deliveries.failed,
        attempted: tick.deliveries.attempted,
        repaired: tick.deliveries.repaired,
        results: tick.deliveries.results,
        reconcile: tick.reconcile,
      },
      null,
      2,
    ),
  );

  process.exit(tick.deliveries.failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
