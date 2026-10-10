import { prisma } from "@matos/db";

/**
 * How a one-shot scheduler process is allowed to end.
 *
 * On Windows, Node aborts with `UV_HANDLE_CLOSING` (`src/win/async.c`) if
 * `process.exit()` runs while a handle is already closing. A tick that called
 * `fetch` leaves undici keep-alive sockets in that state, and the Prisma
 * engine is often closing at the same moment. The JSON result is already
 * printed; the abort is the process tearing itself down. The cure is to drop
 * those handles and let the event loop drain. `process.exit()` is only the
 * backstop for a handle that never closes.
 */
export const SCHEDULER_FORCE_EXIT_MS = 10_000;

const DISPATCHER_SYMBOL_PREFIX = "undici.globalDispatcher.";

/** 0 when every due item was delivered or skipped; 1 when a delivery failed. */
export function schedulerExitCode(failedDeliveries: number): 0 | 1 {
  return failedDeliveries > 0 ? 1 : 0;
}

type FetchDispatcher = object & {
  close?: () => unknown;
  destroy?: (error?: unknown) => unknown;
};

export type ForceExitTimer = { unref: () => void };

export type SchedulerShutdownDeps = {
  disconnect: () => Promise<void>;
  closeDispatcher: () => Promise<void>;
  setExitCode: (code: number) => void;
  scheduleForceExit: (code: number) => ForceExitTimer;
};

/**
 * Last resort. Unref'd so a clean drain does not wait out the delay, and so
 * the timer itself is not the handle that keeps the process alive.
 */
export function scheduleSchedulerForceExit(code: number): ForceExitTimer {
  const timer = setTimeout(() => {
    process.exit(code);
  }, SCHEDULER_FORCE_EXIT_MS);
  timer.unref();
  return timer;
}

export async function disconnectSchedulerDatabase(): Promise<void> {
  await prisma.$disconnect();
}

function asFetchDispatcher(value: unknown): FetchDispatcher | undefined {
  if (!value || typeof value !== "object") return undefined;
  const close = Reflect.get(value, "close");
  const destroy = Reflect.get(value, "destroy");
  if (typeof close !== "function" && typeof destroy !== "function") return undefined;
  return value as FetchDispatcher;
}

function dispatcherFromUndiciModule(undiciModule: unknown): FetchDispatcher | undefined {
  if (!undiciModule || typeof undiciModule !== "object") return undefined;
  const getGlobalDispatcher = Reflect.get(undiciModule, "getGlobalDispatcher");
  if (typeof getGlobalDispatcher !== "function") return undefined;
  try {
    return asFetchDispatcher(getGlobalDispatcher.call(undiciModule));
  } catch {
    return undefined;
  }
}

/**
 * Node's `fetch` keeps idle sockets on the dispatcher undici installs on
 * `globalThis` (`undici.globalDispatcher.1`, and `.2` on newer undici — often
 * the same agent). Those slots are the pool a tick's delivery and read-back
 * requests leave open.
 */
export function collectFetchDispatchers(source: object, undiciModule: unknown): FetchDispatcher[] {
  const found: FetchDispatcher[] = [];
  const fromModule = dispatcherFromUndiciModule(undiciModule);
  if (fromModule) found.push(fromModule);
  for (const symbol of Object.getOwnPropertySymbols(source)) {
    const description = symbol.description;
    if (!description?.startsWith(DISPATCHER_SYMBOL_PREFIX)) continue;
    const dispatcher = asFetchDispatcher(Reflect.get(source, symbol));
    if (dispatcher) found.push(dispatcher);
  }
  return found;
}

function readBuiltinUndici(): unknown {
  const getter = Reflect.get(process, "getBuiltinModule");
  if (typeof getter !== "function") return undefined;
  try {
    return getter.call(process, "undici");
  } catch {
    return undefined;
  }
}

async function releaseFetchDispatcher(dispatcher: FetchDispatcher): Promise<void> {
  if (typeof dispatcher.close === "function") {
    await dispatcher.close();
    return;
  }
  if (typeof dispatcher.destroy === "function") {
    await dispatcher.destroy();
  }
}

export async function closeGlobalFetchDispatcher(options?: {
  source?: object;
  loadUndici?: () => unknown;
}): Promise<void> {
  const source = options?.source ?? globalThis;
  const loadUndici = options?.loadUndici ?? readBuiltinUndici;
  const seen = new Set<FetchDispatcher>();
  for (const dispatcher of collectFetchDispatchers(source, loadUndici())) {
    if (seen.has(dispatcher)) continue;
    seen.add(dispatcher);
    await releaseFetchDispatcher(dispatcher);
  }
}

async function runCleanup(step: () => Promise<void>): Promise<void> {
  try {
    await step();
  } catch {
    // The tick's exit code is already recorded. Failing to drop a handle
    // must not turn a successful delivery into a failed run. A step that
    // hangs instead of rejecting is the force-exit timer's job.
  }
}

/**
 * Record `code`, drop Prisma and fetch handles, and return. The event loop
 * ends on its own once nothing is left open. Call this instead of
 * `process.exit()`.
 */
export async function shutdownScheduler(
  code: number,
  deps: Partial<SchedulerShutdownDeps> = {},
): Promise<void> {
  const setExitCode =
    deps.setExitCode ??
    ((next: number) => {
      process.exitCode = next;
    });
  const scheduleForceExit = deps.scheduleForceExit ?? scheduleSchedulerForceExit;
  const disconnect = deps.disconnect ?? disconnectSchedulerDatabase;
  const closeDispatcher = deps.closeDispatcher ?? (() => closeGlobalFetchDispatcher());

  setExitCode(code);
  // Armed before the awaits so a hang inside disconnect or close still ends.
  scheduleForceExit(code).unref();
  await runCleanup(disconnect);
  await runCleanup(closeDispatcher);
}
