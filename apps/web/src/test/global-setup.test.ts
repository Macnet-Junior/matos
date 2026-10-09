import { describe, expect, it } from "vitest";
import { pnpmExecOptions } from "./global-setup";

describe("pnpm exec on Windows", () => {
  it("uses a shell only where pnpm is a .cmd shim", () => {
    expect(pnpmExecOptions("win32")).toEqual({ shell: true });
    expect(pnpmExecOptions("linux")).toEqual({ shell: false });
    expect(pnpmExecOptions("darwin")).toEqual({ shell: false });
  });
});
