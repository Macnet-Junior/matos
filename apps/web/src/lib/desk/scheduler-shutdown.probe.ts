/**
 * Child-process fixture for the scheduler shutdown tests. Not a cron entry.
 * Writes a line synchronously once shutdown has returned, so the parent can
 * time how long the event loop takes to drain after that.
 */
import fs from "node:fs";
import { shutdownScheduler } from "./scheduler-shutdown";

async function main(): Promise<void> {
  const url = process.env.SCHEDULER_PROBE_URL;
  if (url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`probe fetch failed: ${response.status}`);
    await response.arrayBuffer();
  }
  const code = process.env.SCHEDULER_PROBE_CODE === "1" ? 1 : 0;
  await shutdownScheduler(code);
  fs.writeSync(1, "FINISH_RETURNED\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fs.writeSync(2, `${message}\n`);
  process.exitCode = 1;
});
