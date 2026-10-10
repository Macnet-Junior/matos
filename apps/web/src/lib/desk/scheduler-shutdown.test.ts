import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  SCHEDULER_FORCE_EXIT_MS,
  closeGlobalFetchDispatcher,
  collectFetchDispatchers,
  schedulerExitCode,
  scheduleSchedulerForceExit,
  shutdownScheduler,
  type SchedulerShutdownDeps,
} from "./scheduler-shutdown";

function webRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Injected hooks so a unit test never disconnects the shared Prisma client or closes this process's fetch pool. */
function hooks(overrides: Partial<SchedulerShutdownDeps> = {}): SchedulerShutdownDeps {
  return {
    disconnect: async () => undefined,
    closeDispatcher: async () => undefined,
    setExitCode: () => undefined,
    scheduleForceExit: () => ({ unref: () => undefined }),
    ...overrides,
  };
}

describe("scheduler exit code", () => {
  it("stays 0 when nothing failed", () => {
    expect(schedulerExitCode(0)).toBe(0);
  });

  it("is 1 when a delivery failed", () => {
    expect(schedulerExitCode(1)).toBe(1);
    expect(schedulerExitCode(3)).toBe(1);
  });
});

describe("scheduler shutdown", () => {
  it("records the code, arms an unref'd timer, then disconnects before draining fetch", async () => {
    const order: string[] = [];
    await shutdownScheduler(
      0,
      hooks({
        setExitCode: (code) => order.push(`code:${code}`),
        scheduleForceExit: (code) => {
          order.push(`timer:${code}`);
          return { unref: () => order.push("unref") };
        },
        disconnect: async () => {
          order.push("disconnect");
        },
        closeDispatcher: async () => {
          order.push("close");
        },
      }),
    );
    expect(order).toEqual(["code:0", "timer:0", "unref", "disconnect", "close"]);
  });

  it("keeps a failed tick at exit code 1", async () => {
    const codes: number[] = [];
    await shutdownScheduler(
      schedulerExitCode(2),
      hooks({
        setExitCode: (code) => codes.push(code),
      }),
    );
    expect(codes).toEqual([1]);
  });

  it("writes the code onto the process when no setter is injected", async () => {
    const previous = process.exitCode;
    const leaveHandles = {
      disconnect: async () => undefined,
      closeDispatcher: async () => undefined,
      scheduleForceExit: () => ({ unref: () => undefined }),
    };
    try {
      await shutdownScheduler(0, leaveHandles);
      expect(process.exitCode).toBe(0);
      await shutdownScheduler(1, leaveHandles);
      expect(process.exitCode).toBe(1);
    } finally {
      process.exitCode = previous;
    }
  });

  it("still drains fetch when disconnect rejects, and does not change the code", async () => {
    const order: string[] = [];
    await shutdownScheduler(
      0,
      hooks({
        setExitCode: (code) => order.push(`code:${code}`),
        disconnect: async () => {
          order.push("disconnect");
          throw new Error("engine still closing");
        },
        closeDispatcher: async () => {
          order.push("close");
          throw new Error("socket still closing");
        },
      }),
    );
    expect(order).toEqual(["code:0", "disconnect", "close"]);
  });

  it("does not call process.exit from the cron entry", () => {
    const source = stripComments(
      fs.readFileSync(path.join(webRoot(), "scripts/desk-scheduler.ts"), "utf8"),
    );
    expect(source).not.toContain("process.exit(");
    expect(source).toContain("shutdownScheduler");
    expect(source).toContain("schedulerExitCode");
    const shutdown = stripComments(
      fs.readFileSync(path.join(webRoot(), "src/lib/desk/scheduler-shutdown.ts"), "utf8"),
    );
    // The grace-period timer is the only hard exit. Everything else sets exitCode.
    expect(shutdown.match(/process\.exit\(/g)).toEqual(["process.exit("]);
  });
});

describe("force-exit timer", () => {
  it("is unref'd and exits with the same code only after the grace period", () => {
    vi.useFakeTimers();
    const codes: Array<number | undefined> = [];
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      codes.push(code);
    }) as typeof process.exit);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      timer = scheduleSchedulerForceExit(1) as ReturnType<typeof setTimeout>;
      expect(timer.hasRef()).toBe(false);
      vi.advanceTimersByTime(SCHEDULER_FORCE_EXIT_MS - 1);
      expect(codes).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(codes).toEqual([1]);
    } finally {
      if (timer) clearTimeout(timer);
      exit.mockRestore();
      vi.useRealTimers();
    }
  });

  it("force-exits a successful run with 0", () => {
    vi.useFakeTimers();
    const codes: Array<number | undefined> = [];
    const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      codes.push(code);
    }) as typeof process.exit);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      timer = scheduleSchedulerForceExit(0) as ReturnType<typeof setTimeout>;
      vi.advanceTimersByTime(SCHEDULER_FORCE_EXIT_MS);
      expect(codes).toEqual([0]);
    } finally {
      if (timer) clearTimeout(timer);
      exit.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe("global fetch dispatcher", () => {
  it("closes the dispatcher fetch installed, once, even when two symbols share it", async () => {
    let closed = 0;
    const dispatcher = {
      async close() {
        closed += 1;
      },
      destroy() {
        throw new Error("destroy should not run when close exists");
      },
    };
    const source = {};
    for (const name of ["undici.globalDispatcher.1", "undici.globalDispatcher.2"]) {
      Object.defineProperty(source, Symbol.for(name), { value: dispatcher });
    }
    await closeGlobalFetchDispatcher({
      source,
      loadUndici: () => ({ getGlobalDispatcher: () => dispatcher }),
    });
    expect(closed).toBe(1);
  });

  it("destroys a dispatcher that has no close", async () => {
    let destroyed = 0;
    const source = {};
    Object.defineProperty(source, Symbol.for("undici.globalDispatcher.1"), {
      value: {
        destroy() {
          destroyed += 1;
        },
      },
    });
    await closeGlobalFetchDispatcher({ source, loadUndici: () => undefined });
    expect(destroyed).toBe(1);
  });

  it("ignores unrelated symbols and a missing dispatcher", async () => {
    const source = {};
    Object.defineProperty(source, Symbol.for("not.undici"), {
      value: {
        close() {
          throw new Error("unrelated closer");
        },
      },
    });
    await expect(
      closeGlobalFetchDispatcher({ source, loadUndici: () => undefined }),
    ).resolves.toBeUndefined();
    expect(collectFetchDispatchers(source, { getGlobalDispatcher: () => undefined })).toEqual([]);
  });

  it("reads a dispatcher from the undici builtin when the symbol is absent", () => {
    const dispatcher = { close: () => undefined };
    const found = collectFetchDispatchers({}, { getGlobalDispatcher: () => dispatcher });
    expect(found).toEqual([dispatcher]);
  });
});

type ProbeResult = {
  code: number | null;
  drainMs: number | null;
  stdout: string;
  stderr: string;
};

function runProbe(env: Record<string, string | undefined>): Promise<ProbeResult> {
  const probe = path.join(webRoot(), "src/lib/desk/scheduler-shutdown.probe.ts");
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["exec", "tsx", probe], {
      cwd: webRoot(),
      env: { ...process.env, ...env },
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let finishedAt: number | null = null;
    const killer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`scheduler probe hung\nstdout: ${stdout}\nstderr: ${stderr}`));
    }, 15_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (finishedAt === null && stdout.includes("FINISH_RETURNED")) finishedAt = Date.now();
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(killer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(killer);
      resolve({
        code,
        drainMs: finishedAt === null ? null : Date.now() - finishedAt,
        stdout,
        stderr,
      });
    });
  });
}

async function withDeliveryServer(run: (url: string) => Promise<void>): Promise<void> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("delivery server did not bind a port");
  }
  try {
    await run(`http://127.0.0.1:${address.port}/deliver`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("scheduler process drain", () => {
  it("exits 0 on its own after a fetch, without waiting out keep-alive or the force-exit", async () => {
    await withDeliveryServer(async (url) => {
      const result = await runProbe({
        SCHEDULER_PROBE_URL: url,
        SCHEDULER_PROBE_CODE: "0",
      });
      expect(result.stderr).not.toContain("Assertion failed");
      expect(result.stderr).not.toContain("UV_HANDLE_CLOSING");
      expect(result.stdout).toContain("FINISH_RETURNED");
      expect(result.code).toBe(0);
      // Undici's idle timeout is 4s and the safety timer is 10s. A drained
      // process is gone almost as soon as shutdown returns. A missing
      // timestamp fails the bound instead of passing as zero.
      expect(result.drainMs ?? Number.POSITIVE_INFINITY).toBeLessThan(3_500);
    });
  }, 20_000);

  it("exits 1 when the run failed, and still drains", async () => {
    const result = await runProbe({
      SCHEDULER_PROBE_URL: "",
      SCHEDULER_PROBE_CODE: "1",
    });
    expect(result.stderr).not.toContain("Assertion failed");
    expect(result.code).toBe(1);
    expect(result.drainMs ?? Number.POSITIVE_INFINITY).toBeLessThan(3_500);
  }, 20_000);
});
