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
 *
 * Do not call `process.exit()` after the tick. On Windows that aborts Node
 * while undici keep-alive sockets or the Prisma engine are still closing,
 * after this process has already printed its JSON. Shutdown records the exit
 * code, disconnects Prisma, drains the global fetch dispatcher, and lets the
 * event loop end. The only hard exit is an unref'd timer, and only if the
 * process is still alive ~10s later.
 */
import { ownerEmail } from "@/lib/rbac";
import { runSchedulerTick } from "@/lib/desk/scheduler";
import { schedulerExitCode, shutdownScheduler } from "@/lib/desk/scheduler-shutdown";

async function main(): Promise<number> {
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

  return schedulerExitCode(tick.deliveries.failed);
}

async function entry(): Promise<void> {
  let code = 1;
  try {
    code = await main();
  } catch (err) {
    console.error(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    code = 1;
  }
  await shutdownScheduler(code);
}

entry().catch((err) => {
  console.error(
    JSON.stringify({
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exitCode = 1;
});
